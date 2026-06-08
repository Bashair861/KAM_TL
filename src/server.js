import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
let serverEntryPromise;
async function getServerEntry() {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then((m) => m.default ?? m);
  }
  return serverEntryPromise;
}
function brandedErrorResponse() {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function exposeRuntimeEnv(env) {
  globalThis.__env = {
    ...(globalThis.__env ?? {}),
    ...(env ?? {}),
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function getRuntimeEnvValue(key, env) {
  return env?.[key] ?? globalThis?.process?.env?.[key] ?? globalThis?.__env?.[key];
}

function isLocalRequest(request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function getWebhookTranscriptId(payload) {
  return (
    payload?.transcript_id ??
    payload?.transcriptId ??
    payload?.meeting_id ??
    payload?.meetingId ??
    payload?.id ??
    payload?.data?.transcript_id ??
    payload?.data?.transcriptId ??
    payload?.data?.meeting_id ??
    payload?.data?.meetingId ??
    payload?.data?.id ??
    payload?.transcript?.id ??
    null
  );
}

function parsePositiveInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), max);
}

function timingSafeEqualText(left = "", right = "") {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function sha256HmacHex(secret, value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyFirefliesWebhook(rawBody, request, env) {
  const secret = getRuntimeEnvValue("FIREFLIES_WEBHOOK_SECRET", env);
  if (!secret) {
    return { valid: true, configured: false };
  }

  const signature =
    request.headers.get("x-fireflies-signature") ??
    request.headers.get("x-hub-signature-256") ??
    request.headers.get("x-hub-signature") ??
    request.headers.get("x-signature");
  if (!signature) {
    return { valid: false, configured: true, reason: "Missing webhook signature." };
  }

  const expected = await sha256HmacHex(secret, rawBody);
  const received = signature
    .replace(/^sha256=/i, "")
    .trim()
    .toLowerCase();
  return {
    valid: timingSafeEqualText(expected, received),
    configured: true,
    reason: "Webhook signature did not match.",
  };
}

async function handleFirefliesWebhook(request, env, ctx) {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  const rawBody = await request.text();
  const verification = await verifyFirefliesWebhook(rawBody, request, env);
  if (!verification.valid) {
    return jsonResponse({ ok: false, error: verification.reason }, 401);
  }

  let payload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return jsonResponse({ ok: false, error: "Webhook body must be valid JSON." }, 400);
  }

  const transcriptId = getWebhookTranscriptId(payload);
  if (!transcriptId) {
    return jsonResponse({ ok: false, error: "Webhook payload is missing transcript id." }, 400);
  }

  const syncPromise = import("./services/fireflies-action-items.server.js")
    .then(({ syncFirefliesWebhookMeeting }) =>
      syncFirefliesWebhookMeeting({ transcriptId, payload }),
    )
    .catch((error) => {
      console.error(error);
    });

  if (ctx?.waitUntil) {
    ctx.waitUntil(syncPromise);
  } else {
    void syncPromise;
  }

  return jsonResponse(
    {
      ok: true,
      queued: true,
      transcriptId,
      signatureVerified: verification.configured,
    },
    202,
  );
}

function isAuthorizedSyncRequest(request, env) {
  const secret = getRuntimeEnvValue("FIREFLIES_SYNC_SECRET", env);
  if (!secret) return isLocalRequest(request);

  const url = new URL(request.url);
  const providedSecret = request.headers.get("x-sync-secret") ?? url.searchParams.get("secret");
  return providedSecret === secret;
}

async function readSyncRequestInput(request) {
  const url = new URL(request.url);
  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    return {
      accountId: body.accountId ?? url.searchParams.get("accountId"),
      limit: parsePositiveInt(body.limit ?? url.searchParams.get("limit"), 5, 10),
      daysBack: parsePositiveInt(body.daysBack ?? url.searchParams.get("daysBack"), 60, 180),
    };
  }

  return {
    accountId: url.searchParams.get("accountId"),
    limit: parsePositiveInt(url.searchParams.get("limit"), 5, 10),
    daysBack: parsePositiveInt(url.searchParams.get("daysBack"), 60, 180),
  };
}

async function handleFirefliesSyncRecent(request, env) {
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405);
  }

  if (!isAuthorizedSyncRequest(request, env)) {
    return jsonResponse({ ok: false, error: "Missing or invalid sync secret." }, 401);
  }

  const input = await readSyncRequestInput(request);
  try {
    const { syncFirefliesForAccount, syncFirefliesRecentForAllAccounts } =
      await import("./services/fireflies-action-items.server.js");
    const result = input.accountId
      ? await syncFirefliesForAccount(input)
      : await syncFirefliesRecentForAllAccounts({
          limit: input.limit,
          daysBack: input.daysBack,
        });
    return jsonResponse({ ok: true, result });
  } catch (error) {
    return jsonResponse(
      { ok: false, error: error?.message ?? "Fireflies sync failed." },
      error?.statusCode ?? 500,
    );
  }
}

function isCatastrophicSsrErrorBody(body, responseStatus) {
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }
  const fields = payload;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }
  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}
// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response) {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}
export default {
  async fetch(request, env, ctx) {
    exposeRuntimeEnv(env);
    try {
      const { pathname } = new URL(request.url);
      if (pathname === "/api/fireflies/webhook") {
        return await handleFirefliesWebhook(request, env, ctx);
      }
      if (pathname === "/api/fireflies/sync-recent") {
        return await handleFirefliesSyncRecent(request, env);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
  async scheduled(_controller, env, ctx) {
    exposeRuntimeEnv(env);
    const syncPromise = import("./services/fireflies-action-items.server.js")
      .then(({ syncFirefliesRecentForAllAccounts }) =>
        syncFirefliesRecentForAllAccounts({ limit: 5, daysBack: 2 }),
      )
      .catch((error) => console.error(error));

    ctx.waitUntil(syncPromise);
  },
};
