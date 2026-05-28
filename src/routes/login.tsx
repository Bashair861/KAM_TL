import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, LogIn, Loader2 } from "lucide-react";
import { signIn } from "@/services/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Aether KAM" },
      { name: "description", content: "Sign in to your Aether KAM workspace." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // AuthContext picks up the new session via onAuthStateChange
      // __root.tsx AppShell then redirects to "/"
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-hidden">

      {/* Subtle dot-grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Faint radial glow behind the form */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 50%, oklch(0.55 0.2 250 / 0.08), transparent)",
        }}
      />

      {/* Top-left logo */}
      <header className="relative z-10 px-8 py-6 flex items-center gap-2.5">
        <span className="size-7 rounded-md bg-accent flex items-center justify-center text-white font-bold text-sm select-none">
          A
        </span>
        <span className="font-bold text-base tracking-tight">Aether KAM</span>
        <span className="ml-1 text-[10px] uppercase tracking-widest font-bold text-muted-foreground border border-muted px-1.5 py-0.5 rounded">
          Portal
        </span>
      </header>

      {/* Centered form */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">

          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight">
              Sign in to your workspace
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Enter your credentials to access the KAM portal
            </p>
          </div>

          {/* Card */}
          <form
            onSubmit={handleSubmit}
            className="bg-card border rounded-xl p-6 shadow-xl shadow-black/20 space-y-5"
          >
            {/* Email */}
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
                placeholder="you@aether.io"
                className="w-full h-10 px-3 rounded-md border bg-background text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent transition-shadow"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
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

            {/* Error */}
            {error && (
              <p className="text-xs text-crit bg-crit/10 border border-crit/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 rounded-md bg-accent text-white text-sm font-semibold hover:opacity-90 active:opacity-80 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2 mt-1"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <LogIn className="size-4" />
              )}
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Sub-note */}
          <p className="text-center text-xs text-muted-foreground mt-5">
            Don't have access?{" "}
            <span className="font-semibold text-foreground/70">
              Contact your system administrator.
            </span>
          </p>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-8 py-4 text-center">
        <p className="text-[11px] text-muted-foreground">
          © 2026 Aether KAM · Internal use only · All rights reserved
        </p>
      </footer>

    </div>
  );
}
