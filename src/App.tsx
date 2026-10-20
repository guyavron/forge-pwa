import { useEffect, useState } from "react";
import { CalendarDays, Dumbbell, Gauge, User, UtensilsCrossed } from "lucide-react";
import { getProfile } from "@/lib/api";
import { seedDemoData } from "@/lib/demoSeed";
import { LoadError } from "@/components/ui/LoadError";
import { AuthProvider, useAuth } from "@/lib/authContext";
import type { ProfileRow } from "@/types/database";
import { Auth } from "@/screens/Auth";
import { Dashboard } from "@/screens/Dashboard";
import { History } from "@/screens/History";
import { Nutrition } from "@/screens/Nutrition";
import { Workouts } from "@/screens/Workouts";
import { Profile } from "@/screens/Profile";
import { ResetPassword } from "@/screens/ResetPassword";

// One seeding run per demo user, even if the profile load is triggered twice in a row.
const seeding = new Map<string, Promise<void>>();
function seedOnce(userId: string): Promise<void> {
  if (!seeding.has(userId)) {
    seeding.set(userId, seedDemoData(userId).catch((err) => {
      seeding.delete(userId); // allow Retry to try again
      throw err;
    }));
  }
  return seeding.get(userId)!;
}

type Tab = "dashboard" | "nutrition" | "workouts" | "history" | "profile";

const TABS: { key: Tab; label: string; icon: typeof Gauge }[] = [
  { key: "dashboard", label: "Dashboard", icon: Gauge },
  { key: "nutrition", label: "Nutrition", icon: UtensilsCrossed },
  { key: "workouts", label: "Workouts", icon: Dumbbell },
  { key: "history", label: "History", icon: CalendarDays },
  { key: "profile", label: "Profile", icon: User },
];

function AppShell() {
  const { session, loading: authLoading, recovering, isDemo, signOut } = useAuth();
  // "error" is kept apart from null on purpose: null means "no profile yet, show onboarding",
  // and a failed load must never be mistaken for that (saving onboarding would overwrite the
  // real profile).
  const [profile, setProfile] = useState<ProfileRow | null | "loading" | "seeding" | "error">("loading");
  const [tab, setTab] = useState<Tab>("dashboard");

  const loadProfile = async () => {
    try {
      let row = await getProfile();
      // A brand-new demo account gets a week of sample data instead of the onboarding form.
      if (!row && isDemo && session) {
        setProfile("seeding");
        await seedOnce(session.user.id);
        row = await getProfile();
      }
      setProfile(row);
    } catch (err) {
      console.error(err);
      setProfile("error");
    }
  };

  // Keyed on the user id, not the session object: Supabase hands out a new session object on
  // every token refresh, which would otherwise reload (and for a demo user, re-seed) needlessly.
  const userId = session?.user?.id;
  useEffect(() => {
    if (userId) loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (authLoading) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-elevated border-t-accent" />
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  if (recovering) {
    return <ResetPassword />;
  }

  if (profile === "loading" || profile === "seeding") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-elevated border-t-accent" />
        {profile === "seeding" && <p className="text-[13px] text-text-secondary">Preparing a week of demo data…</p>}
      </div>
    );
  }

  if (profile === "error") {
    return (
      <div className="mx-auto flex h-dvh w-full max-w-lg flex-col justify-center bg-background px-4">
        <LoadError
          message="Couldn't load your profile. Check your connection and try again."
          onRetry={() => {
            setProfile("loading");
            loadProfile();
          }}
        />
        <button type="button" onClick={() => signOut()} className="min-h-9 text-xs font-semibold text-text-muted">
          Log out
        </button>
      </div>
    );
  }

  // Signed in but no profile row yet — this is first run, so the whole screen is onboarding
  // until one exists. This is a standalone screen (not inside the tab shell's own scroll
  // region below), so it needs its own bounded-height scroll container — the onboarding form
  // is taller than most viewports once the keyboard is up, and html/body no longer scroll.
  if (!profile) {
    return (
      <div className="h-dvh overflow-y-auto bg-background [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto w-full max-w-lg">
        <Profile profile={null} onSaved={loadProfile} isOnboarding />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex-1 overflow-y-auto pb-24 pt-[env(safe-area-inset-top)] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto w-full max-w-lg">
        {tab === "dashboard" && <Dashboard profile={profile} />}
        {tab === "nutrition" && <Nutrition profile={profile} />}
        {tab === "workouts" && <Workouts />}
        {tab === "history" && <History profile={profile} />}
        {tab === "profile" && <Profile profile={profile} onSaved={loadProfile} />}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,16px)]">
        <div className="mx-auto flex w-full max-w-lg">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 active:scale-95"
            >
              <Icon size={21} className={active ? "text-accent" : "text-text-muted"} strokeWidth={2} />
              <span className={`text-[9.5px] font-semibold ${active ? "text-accent" : "text-text-muted"}`}>
                {label}
              </span>
            </button>
          );
        })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
