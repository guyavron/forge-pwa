import { useEffect, useState } from "react";
import { CalendarDays, Dumbbell, Gauge, User, UtensilsCrossed } from "lucide-react";
import { getProfile } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/authContext";
import type { ProfileRow } from "@/types/database";
import { Auth } from "@/screens/Auth";
import { Dashboard } from "@/screens/Dashboard";
import { History } from "@/screens/History";
import { Nutrition } from "@/screens/Nutrition";
import { Workouts } from "@/screens/Workouts";
import { Profile } from "@/screens/Profile";
import { ResetPassword } from "@/screens/ResetPassword";

type Tab = "dashboard" | "nutrition" | "workouts" | "history" | "profile";

const TABS: { key: Tab; label: string; icon: typeof Gauge }[] = [
  { key: "dashboard", label: "Dashboard", icon: Gauge },
  { key: "nutrition", label: "Nutrition", icon: UtensilsCrossed },
  { key: "workouts", label: "Workouts", icon: Dumbbell },
  { key: "history", label: "History", icon: CalendarDays },
  { key: "profile", label: "Profile", icon: User },
];

function AppShell() {
  const { session, loading: authLoading, recovering } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null | "loading">("loading");
  const [tab, setTab] = useState<Tab>("dashboard");

  const loadProfile = () => {
    getProfile()
      .then(setProfile)
      .catch((err) => {
        console.error(err);
        setProfile(null);
      });
  };

  useEffect(() => {
    if (session) loadProfile();
  }, [session]);

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

  if (profile === "loading") {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-elevated border-t-accent" />
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
        <Profile profile={null} onSaved={loadProfile} isOnboarding />
      </div>
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <div className="flex-1 overflow-y-auto pb-24 pt-[env(safe-area-inset-top)] [-webkit-overflow-scrolling:touch]">
        {tab === "dashboard" && <Dashboard profile={profile} />}
        {tab === "nutrition" && <Nutrition profile={profile} />}
        {tab === "workouts" && <Workouts />}
        {tab === "history" && <History profile={profile} />}
        {tab === "profile" && <Profile profile={profile} onSaved={loadProfile} />}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,16px)]">
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
