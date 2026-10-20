import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  /** True after the user opens a password-reset link, until they set a new password. */
  recovering: boolean;
  /** True for the anonymous "Try the demo" account. */
  isDemo: boolean;
  finishRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      // A reset-password email link signs the user in with a short-lived session and fires
      // PASSWORD_RECOVERY. Without catching it, they'd land in the app still not knowing
      // their password, so the app shows a "set new password" screen instead.
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(newSession);
      setLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    setRecovering(false);
    await supabase.auth.signOut();
  };

  const isDemo = session?.user?.is_anonymous === true;

  return (
    <AuthContext.Provider
      value={{ session, loading, recovering, isDemo, finishRecovery: () => setRecovering(false), signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
