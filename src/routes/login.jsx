import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LogIn, Loader2, Mail } from "lucide-react";
import { requestPasswordReset, signIn } from "@/services/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In - tkxel KAM" },
      { name: "description", content: "Sign in to your tkxel KAM workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function showResetForm() {
    setResetMode(true);
    setResetSent(false);
    setPassword("");
    setError(null);
  }

  function showSignInForm() {
    setResetMode(false);
    setResetSent(false);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const trimmedEmail = email.trim();

    try {
      if (resetMode) {
        await requestPasswordReset(trimmedEmail);
        setResetSent(true);
      } else {
        await signIn(trimmedEmail, password);
        // AuthContext picks up the new session via onAuthStateChange.
        // __root.jsx AppShell then redirects to "/".
      }
    } catch (err) {
      const fallback = resetMode
        ? "Unable to send a reset link. Try again."
        : "Sign in failed. Check your credentials.";
      setError(getAuthErrorMessage(err, fallback, resetMode));
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

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.55 0.2 250 / 0.08), transparent)",
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
            <h1 className="text-2xl font-bold tracking-tight">
              {resetMode ? "Reset your password" : "Sign in to your workspace"}
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              {resetMode
                ? "Enter your email and we will send you a secure reset link."
                : "Enter your credentials to access the KAM portal"}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-card border rounded-xl p-6 shadow-xl shadow-black/20 space-y-5"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@tkxel.com"
                className="w-full h-10 px-3 rounded-md border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent transition-shadow"
              />
            </div>

            {!resetMode && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label
                    htmlFor="password"
                    className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={showResetForm}
                    className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full h-10 px-3 pr-10 rounded-md border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            )}

            {resetSent && (
              <div className="rounded-md border border-success/20 bg-success/10 px-3 py-3 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  <div>
                    <p className="font-semibold text-foreground">Reset link sent</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      If an account exists for that email, a password reset link is on the way.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && !resetSent && (
              <p className="text-xs text-crit bg-crit/10 border border-crit/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            {resetMode && resetSent ? (
              <button
                type="button"
                onClick={showSignInForm}
                className="w-full h-10 rounded-md border bg-background text-sm font-semibold hover:bg-muted/40 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="size-4" />
                Back to sign in
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-10 rounded-md bg-accent text-white text-sm font-semibold hover:opacity-90 active:opacity-80 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2 mt-1"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : resetMode ? (
                  <Mail className="size-4" />
                ) : (
                  <LogIn className="size-4" />
                )}
                {submitting
                  ? resetMode
                    ? "Sending..."
                    : "Signing in..."
                  : resetMode
                    ? "Send reset link"
                    : "Sign in"}
              </button>
            )}
          </form>

          <p className="text-center text-xs text-muted-foreground mt-5">
            {resetMode ? (
              <>
                Remembered your password?{" "}
                <button
                  type="button"
                  onClick={showSignInForm}
                  className="font-semibold text-foreground/70 hover:text-foreground transition-colors"
                >
                  Sign in instead.
                </button>
              </>
            ) : (
              <>
                Don't have access?{" "}
                <span className="font-semibold text-foreground/70">
                  Contact your system administrator.
                </span>
              </>
            )}
          </p>
        </div>
      </main>

      <footer className="relative z-10 px-8 py-4 text-center">
        <p className="text-[11px] text-muted-foreground">
          Copyright 2026 tkxel KAM - Internal use only - All rights reserved
        </p>
      </footer>
    </div>
  );
}

function getAuthErrorMessage(err, fallback, resetMode) {
  if (!(err instanceof Error)) return fallback;

  const message = err.message.toLowerCase();
  if (resetMode && message.includes("rate limit")) {
    return "Too many reset emails have been requested. Wait a few minutes, then try again. If this keeps happening, ask an administrator to enable custom SMTP for auth emails.";
  }

  return err.message || fallback;
}
