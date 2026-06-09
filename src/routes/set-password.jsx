import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/set-password")({
  head: () => ({
    meta: [
      { title: "Set New Password - tkxel KAM" },
      { name: "description", content: "Set or reset your password for tkxel KAM." },
    ],
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setComplete(true);
      setTimeout(() => navigate({ to: "/" }), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to set password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <header className="relative z-10 px-8 py-6 flex items-center gap-2.5">
        <span className="size-7 rounded-md bg-accent flex items-center justify-center text-white font-bold text-sm select-none">
          t
        </span>
        <span className="font-bold text-base tracking-tight">tkxel KAM</span>
        <span className="ml-1 text-[10px] uppercase tracking-widest font-bold text-muted-foreground border border-muted px-1.5 py-0.5 rounded">
          Portal
        </span>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Create a password for your tkxel KAM account.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-card border rounded-xl p-6 shadow-xl shadow-black/20 space-y-5"
          >
            {loading ? (
              <div className="h-28 flex items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin mr-2" />
                Checking invite
              </div>
            ) : !session ? (
              <div className="text-center py-4">
                <Lock className="size-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-semibold">Password session not found</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Open the latest password reset or invite email link, or request a new reset from
                  the sign-in page.
                </p>
                <button
                  type="button"
                  onClick={() => navigate({ to: "/login" })}
                  className="mt-4 inline-flex h-9 items-center justify-center rounded-md border bg-background px-3 text-sm font-semibold hover:bg-muted/40 transition-colors"
                >
                  Return to sign in
                </button>
              </div>
            ) : complete ? (
              <div className="text-center py-4">
                <CheckCircle2 className="size-9 mx-auto text-success mb-3" />
                <p className="text-sm font-semibold">Password saved</p>
                <p className="text-xs text-muted-foreground mt-2">Taking you to your workspace.</p>
              </div>
            ) : (
              <>
                <label className="space-y-1.5 block">
                  <span className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Password
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full h-10 px-3 pr-10 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </label>

                <label className="space-y-1.5 block">
                  <span className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Confirm Password
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-shadow"
                  />
                </label>

                {error && (
                  <p className="text-xs text-crit bg-crit/10 border border-crit/20 rounded-md px-3 py-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 rounded-md bg-accent text-white text-sm font-semibold hover:opacity-90 active:opacity-80 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2 mt-1"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Lock className="size-4" />
                  )}
                  {submitting ? "Saving..." : "Save password"}
                </button>
              </>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
