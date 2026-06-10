import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase";

function readEnv(name) {
  if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
  return undefined;
}

function validatePasswordResetLookup(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid password reset payload.");
  const email = String(input.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");
  return { email };
}

export const checkPasswordResetEmail = createServerFn({ method: "POST" })
  .inputValidator(validatePasswordResetLookup)
  .handler(async ({ data }) => {
    const supabaseUrl = readEnv("VITE_SUPABASE_URL");
    const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Password reset validation is not configured.");
    }

    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, is_active")
      .eq("email", data.email)
      .maybeSingle();

    if (error) throw error;
    return {
      exists: Boolean(profile),
      isActive: profile?.is_active !== false,
    };
  });

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
export async function requestPasswordReset(email) {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const lookup = await checkPasswordResetEmail({ data: { email: normalizedEmail } });

  if (!lookup.exists) {
    throw new Error("Email is incorrect.");
  }
  if (!lookup.isActive) {
    throw new Error("This user is inactive. Contact your system administrator.");
  }

  const redirectTo =
    typeof window === "undefined" ? undefined : `${window.location.origin}/set-password`;
  const { data, error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
    redirectTo,
  });
  if (error) throw error;
  return data;
}
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
