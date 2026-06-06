import { createServerFn } from "@tanstack/react-start";

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function normalizeInput(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid notification payload.");
  const accessToken = String(input.accessToken ?? "");
  const notificationIds = Array.isArray(input.notificationIds)
    ? input.notificationIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  const badgeKey = String(input.badgeKey ?? "").trim();
  if (!accessToken) throw new Error("Please sign in again before updating notifications.");
  return { accessToken, notificationIds, badgeKey };
}

function isMissingColumnError(error, column = "") {
  const message = `${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  const columnName = String(column ?? "").toLowerCase();
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    (columnName && message.includes(columnName)) ||
    (message.includes("schema cache") && message.includes("column"))
  );
}

async function resolveProfile(admin, user) {
  const { data: byId, error: byIdError } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("id", user.id)
    .maybeSingle();
  if (byIdError) throw byIdError;
  if (byId) return byId;

  if (!user.email) return null;
  const { data: byEmail, error: byEmailError } = await admin
    .from("profiles")
    .select("id, role, email")
    .eq("email", user.email)
    .maybeSingle();
  if (byEmailError) throw byEmailError;
  return byEmail;
}

async function runUpdate(admin, { profileId, notificationIds, badgeKey, includeRoutingColumns }) {
  const updates = includeRoutingColumns
    ? { read: true, read_at: new Date().toISOString() }
    : { read: true };

  let query = admin.from("notifications").update(updates).eq("read", false);

  if (notificationIds.length) {
    query = query.in("id", notificationIds);
    if (includeRoutingColumns) query = query.eq("recipient_profile_id", profileId);
  } else if (badgeKey) {
    query = query.eq("badge_key", badgeKey).eq("recipient_profile_id", profileId);
  } else {
    query = query.eq("recipient_profile_id", profileId);
  }

  return query.select("id");
}

export const markNotificationsReadServer = createServerFn({ method: "POST" })
  .inputValidator(normalizeInput)
  .handler(async ({ data }) => {
    const supabaseUrl = readEnv("VITE_SUPABASE_URL");
    const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
    const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to update notifications.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const requester = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await requester.auth.getUser(data.accessToken);
    if (authError || !authData?.user) {
      throw new Error("Please sign in again before updating notifications.");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const profile = await resolveProfile(admin, authData.user);
    if (!profile?.id) throw new Error("No profile is linked to the signed-in user.");

    const { data: updated, error } = await runUpdate(admin, {
      profileId: profile.id,
      notificationIds: data.notificationIds,
      badgeKey: data.badgeKey,
      includeRoutingColumns: true,
    });

    if (error && (isMissingColumnError(error, "read_at") || isMissingColumnError(error))) {
      const { data: fallbackUpdated, error: fallbackError } = await runUpdate(admin, {
        profileId: profile.id,
        notificationIds: data.notificationIds,
        badgeKey: data.badgeKey,
        includeRoutingColumns: false,
      });
      if (fallbackError) throw fallbackError;
      return { updated: fallbackUpdated?.length ?? 0 };
    }

    if (error) throw error;
    return { updated: updated?.length ?? 0 };
  });
