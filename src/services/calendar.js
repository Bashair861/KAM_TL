import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks.readonly",
];

const SOURCE_COLORS = [
  "bg-accent",
  "bg-success",
  "bg-warn",
  "bg-crit",
  "bg-muted-foreground",
  "bg-primary",
];

function cleanString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function validateAuthInput(data) {
  const input = data && typeof data === "object" ? data : {};
  return {
    authAccessToken: cleanString(input.authAccessToken),
    profileId: cleanString(input.profileId),
    redirectOrigin: cleanString(input.redirectOrigin),
  };
}

function validateCallbackInput(data) {
  const input = data && typeof data === "object" ? data : {};
  return {
    ...validateAuthInput(input),
    code: cleanString(input.code),
    state: cleanString(input.state),
  };
}

function validateCreateEventInput(data) {
  const input = data && typeof data === "object" ? data : {};
  const event = input.event && typeof input.event === "object" ? input.event : {};
  return {
    ...validateAuthInput(input),
    accountId: cleanString(input.accountId),
    activityId: cleanString(input.activityId),
    event: {
      summary: cleanString(event.summary),
      description: cleanString(event.description),
      startDateTime: cleanString(event.startDateTime),
      durationMinutes: Number(event.durationMinutes ?? 45),
      attendees: Array.isArray(event.attendees)
        ? event.attendees
            .map((attendee) => ({
              email: cleanString(attendee?.email),
              displayName: cleanString(attendee?.displayName),
            }))
            .filter((attendee) => attendee.email)
        : [],
    },
  };
}

function env(name) {
  return process.env[name] ?? "";
}

function getSupabaseUrl() {
  return env("SUPABASE_URL") || env("VITE_SUPABASE_URL");
}

function getRequiredEnv(name, fallbackName) {
  const value = env(name) || (fallbackName ? env(fallbackName) : "");
  if (!value) throw new Error(`${name}${fallbackName ? ` or ${fallbackName}` : ""} is required`);
  return value;
}

function getGoogleConfig(redirectOrigin) {
  const clientId = getRequiredEnv("GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_ID");
  const clientSecret = getRequiredEnv(
    "GOOGLE_CALENDAR_CLIENT_SECRET",
    "GOOGLE_OAUTH_CLIENT_SECRET",
  );
  const redirectUri =
    env("GOOGLE_CALENDAR_REDIRECT_URI") || `${redirectOrigin.replace(/\/$/, "")}/calendar/callback`;

  return { clientId, clientSecret, redirectUri };
}

function getSupabaseAdmin(optional = false) {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    if (optional) return null;
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for secure calendar token storage");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getSupabaseUserClient(authAccessToken) {
  const supabaseUrl = getSupabaseUrl();
  const anonKey = getRequiredEnv("VITE_SUPABASE_ANON_KEY");

  if (!authAccessToken) throw new Error("You must be signed in to connect a calendar");

  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${authAccessToken}`,
      },
    },
  });
}

async function getAuthUser(authAccessToken) {
  const userClient = getSupabaseUserClient(authAccessToken);
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser(authAccessToken);

  if (error || !user) throw new Error("Could not verify the signed-in Supabase user");
  return user;
}

async function resolveProfile({ admin, authAccessToken, profileId }) {
  const user = await getAuthUser(authAccessToken);
  let profile = null;

  if (profileId) {
    const { data } = await admin
      .from("profiles")
      .select("id, email, name")
      .eq("id", profileId)
      .maybeSingle();
    profile = data ?? null;
  }

  if (profile && (profile.id === user.id || profile.email === user.email)) {
    return { profileId: profile.id, user, profile };
  }

  const { data: byAuthId } = await admin
    .from("profiles")
    .select("id, email, name")
    .eq("id", user.id)
    .maybeSingle();
  if (byAuthId) return { profileId: byAuthId.id, user, profile: byAuthId };

  const { data: byEmail } = await admin
    .from("profiles")
    .select("id, email, name")
    .eq("email", user.email)
    .maybeSingle();
  if (byEmail) return { profileId: byEmail.id, user, profile: byEmail };

  throw new Error("No matching app profile was found for the signed-in user");
}

function asSearchParams(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value != null && value !== "") params.set(key, value);
  });
  return params;
}

async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: asSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${await response.text()}`);
  }

  return response.json();
}

async function refreshAccessToken({ refreshToken, clientId, clientSecret }) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: asSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${await response.text()}`);
  }

  return response.json();
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error(`Google profile lookup failed: ${await response.text()}`);
  return response.json();
}

async function fetchCalendarList(accessToken) {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) throw new Error(`Google calendar list failed: ${await response.text()}`);
  const payload = await response.json();
  return (payload.items ?? []).filter((calendar) => !calendar.deleted && !calendar.hidden);
}

async function fetchCalendarEvents(accessToken, calendarId, horizonDays) {
  const now = new Date();
  const timeMax = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const params = asSearchParams({
    timeMin: now.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "20",
  });

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) throw new Error(`Google events lookup failed: ${await response.text()}`);
  const payload = await response.json();
  return payload.items ?? [];
}

async function fetchTaskLists(accessToken) {
  const response = await fetch(
    "https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=20",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) throw new Error(`Google task lists lookup failed: ${await response.text()}`);
  const payload = await response.json();
  return payload.items ?? [];
}

async function fetchTasks(accessToken, taskListId, horizonDays) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueMax = new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000);
  const params = asSearchParams({
    dueMin: today.toISOString(),
    dueMax: dueMax.toISOString(),
    showCompleted: "false",
    showDeleted: "false",
    showHidden: "false",
    maxResults: "40",
  });

  const response = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) throw new Error(`Google tasks lookup failed: ${await response.text()}`);
  const payload = await response.json();
  return (payload.items ?? []).filter((task) => task.due);
}

async function createGoogleEvent(accessToken, calendarId, event) {
  const start = new Date(event.startDateTime);
  if (Number.isNaN(start.getTime())) throw new Error("Choose a valid meeting date and time");

  const durationMinutes = Number.isFinite(event.durationMinutes)
    ? Math.max(15, event.durationMinutes)
    : 45;
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId,
    )}/events?sendUpdates=all`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: {
          dateTime: start.toISOString(),
        },
        end: {
          dateTime: end.toISOString(),
        },
        attendees: event.attendees,
        reminders: {
          useDefault: true,
        },
      }),
    },
  );

  if (!response.ok) throw new Error(`Google event creation failed: ${await response.text()}`);
  return response.json();
}

async function ensureFreshAccessToken({ admin, connection, redirectOrigin }) {
  const expiresAt = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : 0;
  const refreshWindow = Date.now() + 5 * 60 * 1000;

  if (connection.access_token && expiresAt > refreshWindow) {
    return connection.access_token;
  }

  if (!connection.refresh_token) {
    throw new Error(`No refresh token stored for ${connection.email}`);
  }

  const { clientId, clientSecret } = getGoogleConfig(redirectOrigin);
  const tokens = await refreshAccessToken({
    refreshToken: connection.refresh_token,
    clientId,
    clientSecret,
  });
  const tokenExpiresAt = new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000);

  const { error } = await admin
    .from("calendar_connections")
    .update({
      access_token: tokens.access_token,
      token_expires_at: tokenExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  if (error) throw error;
  return tokens.access_token;
}

function formatEventStart(start) {
  const raw = start?.dateTime ?? start?.date;
  if (!raw) return "Time TBD";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  if (sameDay(date, today)) return `Today ${time}`;
  if (sameDay(date, tomorrow)) return `Tomorrow ${time}`;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function durationMinutes(start, end) {
  const startRaw = start?.dateTime ?? start?.date;
  const endRaw = end?.dateTime ?? end?.date;
  const startTime = new Date(startRaw).getTime();
  const endTime = new Date(endRaw).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return 0;
  return Math.max(0, Math.round((endTime - startTime) / 60000));
}

function inferEventType(event) {
  const title = cleanString(event.summary).toLowerCase();
  if (title.includes("qbr") || title.includes("quarterly")) return "qbr";
  if (title.includes("call") || title.includes("sync") || title.includes("standup")) return "call";
  if (event.start?.date && !event.start?.dateTime) return "task";
  return "meeting";
}

function mapGoogleEvent({ event, sourceId, connectionId, calendarId }) {
  return {
    id: `${connectionId}:${calendarId}:${event.id}`,
    title: event.summary || "(No title)",
    start: formatEventStart(event.start),
    startDateTime: event.start?.dateTime ?? event.start?.date ?? null,
    durationMin: durationMinutes(event.start, event.end),
    source: sourceId,
    type: inferEventType(event),
    accountId: null,
    attendees: event.attendees?.length ?? undefined,
    htmlLink: event.htmlLink,
  };
}

function mapGoogleTask({ task, sourceId, connectionId, taskListId }) {
  return {
    id: `${connectionId}:${taskListId}:${task.id}`,
    title: task.title || "(No title task)",
    start: formatEventStart({ dateTime: task.due }),
    startDateTime: task.due,
    durationMin: 0,
    source: sourceId,
    type: "task",
    accountId: null,
    attendees: undefined,
    htmlLink: task.webViewLink ?? task.selfLink,
  };
}

export const createGoogleCalendarAuthUrl = createServerFn({ method: "POST" })
  .inputValidator(validateAuthInput)
  .handler(async ({ data }) => {
    if (!data.redirectOrigin) throw new Error("redirectOrigin is required");

    const admin = getSupabaseAdmin();
    const { profileId } = await resolveProfile({
      admin,
      authAccessToken: data.authAccessToken,
      profileId: data.profileId,
    });
    const { clientId, redirectUri } = getGoogleConfig(data.redirectOrigin);
    const state = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error } = await admin.from("calendar_oauth_states").insert({
      id: state,
      profile_id: profileId,
      redirect_origin: data.redirectOrigin,
      expires_at: expiresAt,
    });

    if (error) {
      throw new Error(
        `Could not create calendar OAuth state. Run the calendar SQL migration. ${error.message}`,
      );
    }

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = asSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GOOGLE_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    }).toString();

    return { url: url.toString() };
  });

export const completeGoogleCalendarOAuth = createServerFn({ method: "POST" })
  .inputValidator(validateCallbackInput)
  .handler(async ({ data }) => {
    if (!data.code) throw new Error("Google did not return an authorization code");
    if (!data.state) throw new Error("Google did not return an OAuth state");
    if (!data.redirectOrigin) throw new Error("redirectOrigin is required");

    const admin = getSupabaseAdmin();
    const { profileId } = await resolveProfile({
      admin,
      authAccessToken: data.authAccessToken,
      profileId: data.profileId,
    });

    const { data: stateRecord, error: stateError } = await admin
      .from("calendar_oauth_states")
      .select("*")
      .eq("id", data.state)
      .maybeSingle();

    if (stateError) throw stateError;
    if (!stateRecord) throw new Error("Calendar connection state was not found or has expired");
    if (stateRecord.profile_id !== profileId) {
      throw new Error("Calendar connection state does not match the signed-in user");
    }
    if (new Date(stateRecord.expires_at).getTime() < Date.now()) {
      throw new Error("Calendar connection state has expired. Please connect again.");
    }

    await admin.from("calendar_oauth_states").delete().eq("id", data.state);

    const config = getGoogleConfig(data.redirectOrigin);
    const tokens = await exchangeCodeForTokens({ ...config, code: data.code });
    const googleProfile = await fetchGoogleProfile(tokens.access_token);
    const email = googleProfile.email;

    if (!email) throw new Error("Google did not return an email address for this calendar");

    const { data: existing } = await admin
      .from("calendar_connections")
      .select("id, refresh_token")
      .eq("profile_id", profileId)
      .eq("provider", "google")
      .eq("email", email)
      .eq("calendar_id", "primary")
      .maybeSingle();

    const refreshToken = tokens.refresh_token ?? existing?.refresh_token;
    if (!refreshToken) {
      throw new Error(
        "Google did not return a refresh token. Reconnect with consent, or remove this app from Google Account access and try again.",
      );
    }

    const tokenExpiresAt = new Date(Date.now() + Number(tokens.expires_in ?? 3600) * 1000);
    const { error } = await admin.from("calendar_connections").upsert(
      {
        profile_id: profileId,
        provider: "google",
        provider_account_id: googleProfile.sub,
        email,
        display_name: googleProfile.name ?? email,
        calendar_id: "primary",
        calendar_label: "Primary calendar",
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt.toISOString(),
        scopes: cleanString(tokens.scope).split(" ").filter(Boolean),
        connected: true,
        sync_status: "connected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,provider,email,calendar_id" },
    );

    if (error) throw error;

    return {
      email,
      displayName: googleProfile.name ?? email,
    };
  });

export const fetchGoogleCalendarDashboard = createServerFn({ method: "POST" })
  .inputValidator(validateAuthInput)
  .handler(async ({ data }) => {
    if (!data.authAccessToken) {
      return { sources: [], events: [], connected: false, setupRequired: false };
    }

    const admin = getSupabaseAdmin(true);
    if (!admin) {
      return {
        sources: [],
        events: [],
        connected: false,
        setupRequired: true,
        message: "Add SUPABASE_SERVICE_ROLE_KEY to enable secure calendar token storage.",
      };
    }

    const { profileId } = await resolveProfile({
      admin,
      authAccessToken: data.authAccessToken,
      profileId: data.profileId,
    });

    const { data: connections, error } = await admin
      .from("calendar_connections")
      .select("*")
      .eq("profile_id", profileId)
      .eq("provider", "google")
      .eq("connected", true)
      .order("created_at", { ascending: true });

    if (error) {
      return {
        sources: [],
        events: [],
        connected: false,
        setupRequired: true,
        message: `Run the calendar SQL migration. ${error.message}`,
      };
    }

    if (!connections?.length) {
      return { sources: [], events: [], connected: false, setupRequired: false };
    }

    const sources = [];
    const events = [];
    const notices = [];

    for (const connection of connections) {
      const accessToken = await ensureFreshAccessToken({
        admin,
        connection,
        redirectOrigin: data.redirectOrigin || "http://localhost:5173",
      });
      const calendars = (await fetchCalendarList(accessToken)).slice(0, 8);

      for (const [calendarIndex, calendar] of calendars.entries()) {
        const sourceId = `${connection.id}:${calendar.id}`;
        sources.push({
          id: sourceId,
          label: calendar.summaryOverride || calendar.summary || connection.display_name,
          email: connection.email,
          provider: "Google Calendar",
          color: SOURCE_COLORS[(sources.length + calendarIndex) % SOURCE_COLORS.length],
          connected: true,
          calendarId: calendar.id,
          primary: Boolean(calendar.primary),
        });

        const calendarEvents = await fetchCalendarEvents(accessToken, calendar.id, 30);
        events.push(
          ...calendarEvents.map((event) =>
            mapGoogleEvent({
              event,
              sourceId,
              connectionId: connection.id,
              calendarId: calendar.id,
            }),
          ),
        );
      }

      try {
        const taskLists = (await fetchTaskLists(accessToken)).slice(0, 8);

        for (const taskList of taskLists) {
          const sourceId = `${connection.id}:tasks:${taskList.id}`;
          sources.push({
            id: sourceId,
            label: `${taskList.title || "Tasks"} Tasks`,
            email: connection.email,
            provider: "Google Tasks",
            color: SOURCE_COLORS[sources.length % SOURCE_COLORS.length],
            connected: true,
            calendarId: taskList.id,
            primary: false,
          });

          const tasks = await fetchTasks(accessToken, taskList.id, 30);
          events.push(
            ...tasks.map((task) =>
              mapGoogleTask({
                task,
                sourceId,
                connectionId: connection.id,
                taskListId: taskList.id,
              }),
            ),
          );
        }
      } catch (error) {
        notices.push(
          "Google Tasks are not available yet. Enable the Google Tasks API, reconnect calendar consent, then sync again.",
        );
        console.error(error);
      }

      await admin
        .from("calendar_connections")
        .update({
          last_synced_at: new Date().toISOString(),
          sync_status: "synced",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);
    }

    events.sort((a, b) => {
      const aTime = new Date(a.startDateTime ?? 0).getTime();
      const bTime = new Date(b.startDateTime ?? 0).getTime();
      return aTime - bTime;
    });

    return {
      sources,
      events: events.slice(0, 80),
      connected: true,
      setupRequired: false,
      message: notices[0] ?? "",
      syncedAt: new Date().toISOString(),
    };
  });

export const createGoogleCalendarEvent = createServerFn({ method: "POST" })
  .inputValidator(validateCreateEventInput)
  .handler(async ({ data }) => {
    if (!data.authAccessToken) throw new Error("Please sign in before scheduling a meeting");
    if (!data.event.summary) throw new Error("Meeting subject is required");
    if (!data.event.startDateTime) throw new Error("Meeting date and time are required");

    const admin = getSupabaseAdmin(true);
    if (!admin) {
      return {
        ok: false,
        setupRequired: true,
        message: "Calendar scheduling needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      };
    }

    const { profileId } = await resolveProfile({
      admin,
      authAccessToken: data.authAccessToken,
      profileId: data.profileId,
    });

    const { data: connection, error } = await admin
      .from("calendar_connections")
      .select("*")
      .eq("profile_id", profileId)
      .eq("provider", "google")
      .eq("connected", true)
      .eq("calendar_id", "primary")
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        setupRequired: true,
        message: `Run the calendar SQL migration. ${error.message}`,
      };
    }

    if (!connection) {
      return {
        ok: false,
        setupRequired: false,
        message: "Connect Google Calendar before scheduling meetings.",
      };
    }

    const accessToken = await ensureFreshAccessToken({
      admin,
      connection,
      redirectOrigin: data.redirectOrigin || "http://localhost:8080",
    });
    const event = await createGoogleEvent(accessToken, connection.calendar_id || "primary", data.event);

    return {
      ok: true,
      eventId: event.id,
      htmlLink: event.htmlLink,
      message: "Meeting scheduled and invitations sent.",
      accountId: data.accountId,
      activityId: data.activityId,
    };
  });
