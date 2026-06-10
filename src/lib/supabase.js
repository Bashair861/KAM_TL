import { createClient } from "@supabase/supabase-js";

function getRuntimeEnvValue(key) {
  const metaEnv =
    typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : undefined;
  return (
    metaEnv?.[key] ??
    globalThis?.process?.env?.[key] ??
    globalThis?.__env?.[key] ??
    globalThis?.[key]
  );
}

const supabaseUrl = getRuntimeEnvValue("VITE_SUPABASE_URL");
const supabaseAnonKey = getRuntimeEnvValue("VITE_SUPABASE_ANON_KEY");
const serverServiceRoleKey =
  typeof window === "undefined" ? getRuntimeEnvValue("SUPABASE_SERVICE_ROLE_KEY") : "";
const supabaseKey = serverServiceRoleKey || supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseKey);
