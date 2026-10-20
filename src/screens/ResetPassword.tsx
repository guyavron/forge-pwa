import { useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/authContext";

/** Shown after the user follows a password-reset email link (PASSWORD_RECOVERY event). */
export function ResetPassword() {
  const { finishRecovery, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setError(null);
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError(updateError.message);
    finishRecovery();
  };

  const inputClass =
    "mb-3.5 min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted";

  return (
    <div className="h-dvh overflow-y-auto bg-background [-webkit-overflow-scrolling:touch]">
      <div className="flex min-h-full flex-col justify-center px-6 py-8">
        <div className="mx-auto mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted">
            <KeyRound size={26} className="text-accent" />
          </div>
          <h1 className="text-2xl font-extrabold text-text-primary">Set a new password</h1>
          <p className="mt-1 text-sm text-text-secondary">Choose a password you'll remember.</p>
        </div>

        <label className="mb-1.5 block text-xs font-bold text-text-secondary">New password</label>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className={inputClass}
        />
        <label className="mb-1.5 block text-xs font-bold text-text-secondary">Confirm password</label>
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          className={inputClass}
        />

        {error && <p className="mb-2 text-xs font-semibold text-danger">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-2 min-h-12 w-full rounded-xl bg-accent text-[15px] font-extrabold text-background disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save password"}
        </button>
        <button type="button" onClick={signOut} className="mt-4 text-center text-[11.5px] font-bold text-text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}
