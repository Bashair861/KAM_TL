import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { completeGoogleCalendarOAuth } from "@/services/calendar";

export const Route = createFileRoute("/calendar/callback")({
  head: () => ({
    meta: [{ title: "Connecting Calendar - tkxel KAM" }],
  }),
  component: CalendarCallbackPage,
});

function CalendarCallbackPage() {
  const navigate = useNavigate();
  const completeCalendarOAuth = useServerFn(completeGoogleCalendarOAuth);
  const { session, profile, loading } = useAuth();
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const params = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  useEffect(() => {
    if (loading || complete || error) return;
    if (!session?.access_token || !profile?.id) {
      setError("Please sign in again before connecting Google Calendar.");
      return;
    }

    const code = params.get("code");
    const state = params.get("state");
    const googleError = params.get("error");

    if (googleError) {
      setError(`Google calendar connection was cancelled or failed: ${googleError}`);
      return;
    }

    if (!code || !state) {
      setError("Google did not return the required calendar authorization details.");
      return;
    }

    completeCalendarOAuth({
      data: {
        authAccessToken: session.access_token,
        profileId: profile.id,
        code,
        state,
        redirectOrigin: window.location.origin,
      },
    })
      .then(() => {
        setComplete(true);
        const returnTo = window.sessionStorage.getItem("kamCalendarReturnTo");
        window.sessionStorage.removeItem("kamCalendarReturnTo");
        if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
          window.location.replace(returnTo);
          return;
        }
        navigate({ to: "/", replace: true });
      })
      .catch((err) => {
        setError(err?.message ?? "Could not connect Google Calendar.");
      });
  }, [
    complete,
    completeCalendarOAuth,
    error,
    loading,
    navigate,
    params,
    profile?.id,
    session?.access_token,
  ]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border rounded-2xl shadow-sm p-6 text-center">
        <span className="mx-auto size-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
          {error ? (
            <CalendarDays className="size-5" />
          ) : (
            <Loader2 className="size-5 animate-spin" />
          )}
        </span>
        <h1 className="mt-4 text-lg font-bold">
          {error ? "Calendar connection needs attention" : "Connecting Google Calendar"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error ? error : "Please wait while we securely finish the Google Calendar connection."}
        </p>
        {error && (
          <button
            onClick={() => navigate({ to: "/", replace: true })}
            className="mt-5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-bold"
          >
            Back to dashboard
          </button>
        )}
      </div>
    </div>
  );
}
