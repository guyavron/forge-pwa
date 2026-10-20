import { useState } from "react";
import { Dumbbell, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export function Auth() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupNotice, setSignupNotice] = useState<string | null>(null);

  const canSubmit = email.trim().length > 3 && password.length >= 6;

  const handleForgotPassword = async () => {
    setSignupNotice(null);
    if (email.trim().length <= 3) {
      setError("Enter your email above, then tap \"Forgot password?\" again.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setSubmitting(false);
    if (resetError) setError(resetError.message);
    else setSignupNotice("If that email has an account, a reset link is on its way.");
  };

  // Anonymous Supabase session: a real, RLS-isolated account with no email or password, so a
  // recruiter or visitor can try every feature without signing up.
  const handleDemo = async () => {
    setError(null);
    setSignupNotice(null);
    setSubmitting(true);
    const { error: demoError } = await supabase.auth.signInAnonymously();
    setSubmitting(false);
    if (demoError) setError(`Demo is unavailable right now (${demoError.message}).`);
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError("Enter a valid email and a password of at least 6 characters.");
      return;
    }
    setError(null);
    setSignupNotice(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        if (data.session == null) {
          setSignupNotice("Account created — check your email to confirm before logging in.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-dvh overflow-y-auto bg-background [-webkit-overflow-scrolling:touch]">
      <div className="flex min-h-full flex-col justify-center px-6 py-8">
      <div className="mx-auto mb-8 flex flex-col items-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted">
          <Dumbbell size={26} className="text-accent" />
        </div>
        <h1 className="text-2xl font-extrabold text-text-primary">Forge</h1>
        <p className="mt-1 text-sm text-text-secondary">Fitness & nutrition, tracked properly.</p>
      </div>

      <div className="mb-5 flex rounded-xl border border-border bg-surface-elevated p-1">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
            setSignupNotice(null);
          }}
          className={`min-h-10 flex-1 rounded-lg text-[13.5px] font-bold ${
            mode === "login" ? "bg-accent text-background" : "text-text-secondary"
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
            setSignupNotice(null);
          }}
          className={`min-h-10 flex-1 rounded-lg text-[13.5px] font-bold ${
            mode === "signup" ? "bg-accent text-background" : "text-text-secondary"
          }`}
        >
          Sign Up
        </button>
      </div>

      <label className="mb-1.5 block text-xs font-bold text-text-secondary">Email</label>
      <input
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="mb-3.5 min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted"
      />

      <label className="mb-1.5 block text-xs font-bold text-text-secondary">Password</label>
      <input
        type="password"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 6 characters"
        className="mb-1.5 min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted"
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
        }}
      />

      {mode === "login" && (
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={submitting}
          className="mb-2 block text-left text-[11.5px] font-bold text-accent disabled:opacity-50"
        >
          Forgot password?
        </button>
      )}

      {error && <p className="mb-2 text-xs font-semibold text-danger">{error}</p>}
      {signupNotice && <p className="mb-2 text-xs font-semibold text-success">{signupNotice}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-4 min-h-12 w-full rounded-xl bg-accent text-[15px] font-extrabold text-background disabled:opacity-50"
      >
        {submitting ? "Please wait…" : mode === "login" ? "Log In" : "Create Account"}
      </button>

      <button
        type="button"
        onClick={handleDemo}
        disabled={submitting}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated text-[14px] font-bold text-text-primary disabled:opacity-50"
      >
        <Sparkles size={16} className="text-accent" />
        Try the demo — no sign-up
      </button>

      <p className="mt-4 text-center text-[11.5px] text-text-muted">
        {mode === "login" ? "Don't have an account? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="font-bold text-accent"
        >
          {mode === "login" ? "Sign up" : "Log in"}
        </button>
      </p>
      </div>
    </div>
  );
}
