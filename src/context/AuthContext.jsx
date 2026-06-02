import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeRole } from "@/data/kam-data";
const AuthContext = createContext({
  session: null,
  profile: null,
  loading: true,
});
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  function isMissingColumnError(error, column) {
    if (!error) return false;
    const message = error.message?.toLowerCase() ?? "";
    return (
      error.code === "42703" || error.code === "PGRST204" || message.includes(column.toLowerCase())
    );
  }
  function mapProfile(row) {
    return {
      id: row.id,
      name: row.name,
      initials: row.initials,
      role: normalizeRole(row.role),
      email: row.email,
      isActive: row.is_active ?? true,
    };
  }
  async function fetchProfileBy(field, value) {
    const withStatus = await supabase
      .from("profiles")
      .select("id, name, initials, role, email, is_active")
      .eq(field, value)
      .maybeSingle();
    if (!withStatus.error) return withStatus.data ? mapProfile(withStatus.data) : null;
    if (!isMissingColumnError(withStatus.error, "is_active")) return null;
    const { data } = await supabase
      .from("profiles")
      .select("id, name, initials, role, email")
      .eq(field, value)
      .maybeSingle();
    return data ? mapProfile(data) : null;
  }
  async function loadProfile(userId, email) {
    const byId = await fetchProfileBy("id", userId);
    if (byId) {
      if (!byId.isActive) {
        setProfile(null);
        await supabase.auth.signOut();
        return;
      }
      setProfile(byId);
      return;
    }
    // Seed profiles have static UUIDs — fall back to email match
    if (email) {
      const byEmail = await fetchProfileBy("email", email);
      if (byEmail && !byEmail.isActive) {
        setProfile(null);
        await supabase.auth.signOut();
        return;
      }
      setProfile(byEmail);
    } else {
      setProfile(null);
    }
  }
  useEffect(() => {
    // Load existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id, session.user.email).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
    // Keep in sync with auth changes (sign in / sign out)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id, session.user.email);
      } else {
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);
  return (
    <AuthContext.Provider value={{ session, profile, loading }}>{children}</AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
