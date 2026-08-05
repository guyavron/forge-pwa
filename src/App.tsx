import { useEffect, useState } from "react";
import { Dumbbell, Gauge, User, UtensilsCrossed } from "lucide-react";
import { getProfile } from "@/lib/api";
import type { ProfileRow } from "@/types/database";
import { Dashboard } from "@/screens/Dashboard";
import { Nutrition } from "@/screens/Nutrition";
import { Workouts } from "@/screens/Workouts";
import { Profile } from "@/screens/Profile";

type Tab = "dashboard" | "nutrition" | "workouts" | "profile";

const TABS: { key: Tab; label: string; icon: typeof Gauge }[] = [
  { key: "dashboard", label: "Dashboard", icon: Gauge },
  { key: "nutrition", label: "Nutrition", icon: UtensilsCrossed },
  { key: "workouts", label: "Workouts", icon: Dumbbell },
  { key: "profile", label: "Profile", icon: User },
];

export default function App() {
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

  useEffect(loadProfile, []);

  if (profile === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-elevated border-t-accent" />
      </div>
    );
  }

  // No profile row yet — this is first run, so the whole screen is onboarding until one exists.
  if (!profile) {
    return (
      <div className="min-h-dvh bg-background">
        <Profile profile={null} onSaved={loadProfile} isOnboarding />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="flex-1 overflow-y-auto pb-24" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        {tab === "dashboard" && <Dashboard profile={profile} />}
        {tab === "nutrition" && <Nutrition profile={profile} />}
        {tab === "workouts" && <Workouts />}
        {tab === "profile" && <Profile profile={profile} onSaved={loadProfile} />}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 flex border-t border-border bg-surface"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 active:scale-95"
            >
              <Icon size={22} className={active ? "text-accent" : "text-text-muted"} strokeWidth={2} />
              <span className={`text-[10.5px] font-semibold ${active ? "text-accent" : "text-text-muted"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
