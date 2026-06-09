import { createServerFn } from "@tanstack/react-start";
import {
  normalizeEmail,
  normalizeId,
  normalizeText,
  normalizeUrl,
} from "@/services/validation";

const VALID_ROLES = new Set(["CEO", "Head of KAM", "KAM"]);

function normalizeRole(role) {
  if (role === "C Level") return "CEO";
  return VALID_ROLES.has(role) ? role : "KAM";
}

function initialsFromName(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function validateCreateUserInput(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid user payload.");
  const name = normalizeText(input.name, {
    field: "User name",
    required: true,
    maxLength: 160,
    meaningful: true,
  });
  const email = normalizeEmail(input.email, "User email", { required: true });
  const role = normalizeRole(String(input.role ?? "KAM"));
  const accessToken = String(input.accessToken ?? "");
  const redirectTo = normalizeUrl(input.redirectTo, "Redirect URL", { allowLocalhost: true }) ?? "";
  if (!accessToken) throw new Error("You must be signed in to create users.");
  return { name, email, role, accessToken, redirectTo };
}

function validateDeleteUserInput(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid user payload.");
  const userId = normalizeId(input.userId, "User id");
  const accessToken = String(input.accessToken ?? "");
  if (!accessToken) throw new Error("You must be signed in to delete users.");
  return { userId, accessToken };
}

function isMissingAuthUserError(error) {
  const message = error?.message?.toLowerCase() ?? "";
  return error?.status === 404 || message.includes("not found") || message.includes("no user");
}

export const createManagedAuthUser = createServerFn({ method: "POST" })
  .inputValidator(validateCreateUserInput)
  .handler(async ({ data }) => {
    const supabaseUrl = readEnv("VITE_SUPABASE_URL");
    const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
    const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to create sign-in users.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const requester = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });

    const { data: canManage, error: permissionError } = await requester.rpc(
      "current_user_is_head_of_kam",
    );
    if (permissionError) throw permissionError;
    if (!canManage) throw new Error("Only Head of KAM can create users.");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const initials = initialsFromName(data.name);

    const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(
      data.email,
      {
        data: { name: data.name, initials, role: data.role },
        ...(data.redirectTo ? { redirectTo: data.redirectTo } : {}),
      },
    );
    if (authError) throw authError;

    const authUser = authData.user;
    if (!authUser?.id) throw new Error("Supabase did not return the created auth user.");

    const { data: existingProfiles, error: existingError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", data.email);
    if (existingError) throw existingError;

    await Promise.all(
      (existingProfiles ?? [])
        .filter((profile) => profile.id !== authUser.id)
        .map(async (profile) => {
          await admin.from("accounts").update({ assigned_kam_id: authUser.id }).eq(
            "assigned_kam_id",
            profile.id,
          );
          await admin.from("profiles").delete().eq("id", profile.id);
        }),
    );

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .upsert(
        {
          id: authUser.id,
          name: data.name,
          initials,
          role: data.role,
          email: data.email,
          is_active: true,
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (profileError) throw profileError;
    return { profile, inviteSent: true };
  });

export const deleteManagedAuthUser = createServerFn({ method: "POST" })
  .inputValidator(validateDeleteUserInput)
  .handler(async ({ data }) => {
    const supabaseUrl = readEnv("VITE_SUPABASE_URL");
    const supabaseAnonKey = readEnv("VITE_SUPABASE_ANON_KEY");
    const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to delete users.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const requester = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });

    const { data: requesterUser, error: requesterError } = await requester.auth.getUser(
      data.accessToken,
    );
    if (requesterError) throw requesterError;
    if (requesterUser?.user?.id === data.userId) {
      throw new Error("You cannot delete your own user account.");
    }

    const { data: canManage, error: permissionError } = await requester.rpc(
      "current_user_is_head_of_kam",
    );
    if (permissionError) throw permissionError;
    if (!canManage) throw new Error("Only Head of KAM can delete users.");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, name, email, role, is_active")
      .eq("id", data.userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw new Error("User profile was not found.");

    if (profile.role === "Head of KAM" && profile.is_active !== false) {
      const { count, error: headCountError } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "Head of KAM")
        .eq("is_active", true)
        .neq("id", data.userId);
      if (headCountError) throw headCountError;
      if ((count ?? 0) === 0) throw new Error("Keep at least one active Head of KAM user.");
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(data.userId);
    if (authDeleteError && !isMissingAuthUserError(authDeleteError)) throw authDeleteError;

    const { error: assignmentError } = await admin
      .from("accounts")
      .update({ assigned_kam_id: null })
      .eq("assigned_kam_id", data.userId);
    if (assignmentError) throw assignmentError;

    const { error: deleteProfileError } = await admin.from("profiles").delete().eq("id", data.userId);
    if (deleteProfileError) throw deleteProfileError;

    return { id: data.userId, profile };
  });
