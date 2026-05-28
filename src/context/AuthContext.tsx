import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import type { Role } from "@/data/kam-data";

export type Profile = {
  id: string;
  name: string;
  initials: string;
  role: Role;
  email: string | null;
};

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  session: null,
  profile: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string, email?: string | null) {
    const { data } = await supabase
      .from("profiles")
      .select("id, name, initials, role, email")
      .eq("id", userId)
      .single();

    if (data) {
      setProfile(data as Profile);
      return;
    }

    // Seed profiles have static UUIDs — fall back to email match
    if (email) {
      const { data: byEmail } = await supabase
        .from("profiles")
        .select("id, name, initials, role, email")
        .eq("email", email)
        .single();
      setProfile((byEmail as Profile) ?? null);
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session) {
          loadProfile(session.user.id, session.user.email);
        } else {
          setProfile(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
