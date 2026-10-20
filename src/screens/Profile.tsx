import { useMemo, useState, type ReactNode } from "react";
import { LogOut, Sparkles, Download } from "lucide-react";
import { saveProfile, getAllDataForExport } from "@/lib/api";
import { useAuth } from "@/lib/authContext";
import { ACTIVITY_LEVELS, FITNESS_GOALS, calculateMacros } from "@/lib/macroCalculator";
import { exportDataToCsv } from "@/lib/csvExport";
import type { ActivityLevel, FitnessGoal, Gender, ProfileRow } from "@/types/database";

interface ProfileProps {
  profile: ProfileRow | null;
  onSaved: () => void;
  isOnboarding?: boolean;
}

export function Profile({ profile, onSaved, isOnboarding = false }: ProfileProps) {
  const { signOut, isDemo } = useAuth();

  const [age, setAge] = useState(profile?.age?.toString() ?? "");
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [height, setHeight] = useState(profile?.height?.toString() ?? "");
  const [currentWeight, setCurrentWeight] = useState(profile?.current_weight?.toString() ?? "");
  const [targetWeight, setTargetWeight] = useState(profile?.target_weight?.toString() ?? "");
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(profile?.activity_level ?? null);
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoal>(profile?.fitness_goal ?? "maintenance");
  const [calorieTarget, setCalorieTarget] = useState(profile?.daily_calorie_target?.toString() ?? "");
  const [proteinTarget, setProteinTarget] = useState(profile?.daily_protein_target?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [exporting, setExporting] = useState(false);

  const recommendation = useMemo(() => {
    const ageN = Number(age);
    const heightN = Number(height);
    const weightN = Number(currentWeight);
    if (!gender || !activityLevel || ageN <= 0 || heightN <= 0 || weightN <= 0) return null;
    return calculateMacros({
      age: ageN,
      gender,
      heightCm: heightN,
      weightKg: weightN,
      activityLevel,
      goal: fitnessGoal,
    });
  }, [age, gender, height, currentWeight, activityLevel, fitnessGoal]);

  const applyRecommendation = () => {
    if (!recommendation) return;
    setCalorieTarget(String(recommendation.calorieTarget));
    setProteinTarget(String(recommendation.proteinTarget));
  };

  const inRange = (v: string, min: number, max: number) => Number(v) >= min && Number(v) <= max;

  const canSubmit =
    Number(age) > 0 &&
    !!gender &&
    Number(height) > 0 &&
    Number(currentWeight) > 0 &&
    Number(targetWeight) > 0 &&
    !!activityLevel &&
    Number(calorieTarget) > 0 &&
    Number(proteinTarget) > 0;

  // Typos like 1780 cm or 7 kg would quietly produce absurd daily targets, so obvious
  // out-of-range values are rejected with a specific message.
  const rangeProblem = !inRange(age, 13, 100)
    ? "Age must be between 13 and 100."
    : !inRange(height, 100, 250)
      ? "Height must be between 100 and 250 cm."
      : !inRange(currentWeight, 30, 300) || !inRange(targetWeight, 30, 300)
        ? "Weights must be between 30 and 300 kg."
        : !inRange(calorieTarget, 1000, 6000)
          ? "Daily calorie target must be between 1000 and 6000 kcal."
          : !inRange(proteinTarget, 30, 400)
            ? "Daily protein target must be between 30 and 400 g."
            : null;

  const handleSubmit = async () => {
    if (!canSubmit) {
      alert("Fill in age, gender, height, both weights, activity level, and confirm your calorie/protein targets.");
      return;
    }
    if (rangeProblem) {
      alert(rangeProblem);
      return;
    }
    setSaving(true);
    try {
      await saveProfile({
        age: Math.round(Number(age)),
        gender,
        height: Number(height),
        current_weight: Number(currentWeight),
        target_weight: Number(targetWeight),
        activity_level: activityLevel,
        fitness_goal: fitnessGoal,
        // daily_calorie_target/daily_protein_target are `integer` columns — round manually
        // typed values (the calculator's own output is already an integer).
        daily_calorie_target: Math.round(Number(calorieTarget)),
        daily_protein_target: Math.round(Number(proteinTarget)),
      });
      onSaved();
      if (!isOnboarding) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
      }
    } catch (err) {
      const pgError = err as { message?: string; details?: string; hint?: string; code?: string };
      console.error("Profile save failed:", {
        message: pgError?.message,
        details: pgError?.details,
        hint: pgError?.hint,
        code: pgError?.code,
      });
      alert("Couldn't save your profile — check the console for details.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { meals, workouts, exerciseLogs } = await getAllDataForExport();
      if (meals.length === 0 && workouts.length === 0) {
        alert("Nothing logged yet — nothing to export.");
        return;
      }
      exportDataToCsv(meals, workouts, exerciseLogs);
    } catch (err) {
      console.error(err);
      alert("Couldn't export your data — check the console for details.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`px-4 pt-3 ${isOnboarding ? "pb-10 pt-[env(safe-area-inset-top)]" : ""}`}>
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-text-primary">{isOnboarding ? "Welcome to Forge" : "Profile"}</h1>
        {!isOnboarding && (
          <button
            type="button"
            onClick={() => {
              if (confirm("Log out of Forge?")) signOut();
            }}
            className="flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-bold text-text-secondary"
          >
            <LogOut size={13} /> Log Out
          </button>
        )}
      </div>
      {isDemo && (
        <p className="mb-3 rounded-lg border border-border bg-surface-elevated px-3 py-2 text-xs text-text-secondary">
          You're using the demo account. Your data is kept only until you log out — sign up to keep it.
        </p>
      )}
      <p className="mb-5 text-sm text-text-secondary">
        {isOnboarding
          ? "Tell us about yourself and we'll calculate your daily targets."
          : "Update your stats and daily targets."}
      </p>

      <div className="mb-3.5 grid grid-cols-2 gap-3">
        <Field label="Age">
          <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="28" className={inputClass} />
        </Field>
        <Field label="Gender">
          <div className="flex gap-2">
            {(["male", "female"] as Gender[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g)}
                className={`min-h-11 flex-1 rounded-xl border text-[13px] font-bold capitalize ${
                  gender === g ? "border-accent bg-accent-muted text-accent" : "border-border bg-surface-elevated text-text-secondary"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="mb-3.5 grid grid-cols-3 gap-3">
        <Field label="Height (cm)">
          <input type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="178" className={inputClass} />
        </Field>
        <Field label="Current (kg)">
          <input type="number" inputMode="decimal" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} placeholder="75" className={inputClass} />
        </Field>
        <Field label="Target (kg)">
          <input type="number" inputMode="decimal" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="82" className={inputClass} />
        </Field>
      </div>

      <Field label="Activity Level" className="mb-3.5">
        <div className="flex flex-col gap-2">
          {ACTIVITY_LEVELS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setActivityLevel(a.value)}
              className={`min-h-14 rounded-xl border px-3 py-2 text-left ${
                activityLevel === a.value ? "border-accent bg-accent-muted" : "border-border bg-surface-elevated"
              }`}
            >
              <p className={`text-[13px] font-bold ${activityLevel === a.value ? "text-accent" : "text-text-primary"}`}>{a.label}</p>
              <p className="text-[11.5px] text-text-secondary">{a.description}</p>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Primary Goal" className="mb-3.5">
        <div className="flex flex-col gap-2">
          {FITNESS_GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setFitnessGoal(g.value)}
              className={`min-h-11 rounded-xl border px-3 text-left text-[13px] font-semibold ${
                fitnessGoal === g.value ? "border-accent bg-accent-muted text-accent" : "border-border bg-surface-elevated text-text-secondary"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </Field>

      {recommendation && (
        <div className="mb-3.5 rounded-2xl border border-accent/40 bg-accent-muted p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles size={14} className="text-accent" />
            <p className="text-xs font-extrabold uppercase tracking-wide text-accent">Calculated Recommendation</p>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 text-[13px] text-text-primary">
            <p>
              BMR <span className="float-right font-bold">{recommendation.bmr} kcal</span>
            </p>
            <p>
              TDEE <span className="float-right font-bold">{recommendation.tdee} kcal</span>
            </p>
            <p>
              Calories <span className="float-right font-bold">{recommendation.calorieTarget} kcal</span>
            </p>
            <p>
              Protein <span className="float-right font-bold">{recommendation.proteinTarget} g</span>
            </p>
          </div>
          <button
            type="button"
            onClick={applyRecommendation}
            className="min-h-10 w-full rounded-lg bg-accent text-[13px] font-extrabold text-background"
          >
            Apply Recommendation
          </button>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Field label="Daily Calorie Target">
          <input type="number" inputMode="numeric" value={calorieTarget} onChange={(e) => setCalorieTarget(e.target.value)} placeholder="3000" className={inputClass} />
        </Field>
        <Field label="Daily Protein Target (g)">
          <input type="number" inputMode="numeric" value={proteinTarget} onChange={(e) => setProteinTarget(e.target.value)} placeholder="150" className={inputClass} />
        </Field>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="min-h-12 w-full rounded-xl bg-accent text-[15px] font-extrabold text-background disabled:opacity-50"
      >
        {saving ? "Saving…" : isOnboarding ? "Finish Setup" : savedFlash ? "Saved ✓" : "Save Changes"}
      </button>

      {isOnboarding && (
        <>
          <p className="mt-4 text-center text-[11.5px] text-text-muted">
            Fill in your stats above to see your calculated recommendation, or enter targets manually.
          </p>
          <button
            type="button"
            onClick={() => {
              if (confirm("Log out?")) signOut();
            }}
            className="mt-3 min-h-9 w-full text-center text-xs font-semibold text-text-muted"
          >
            Log out
          </button>
        </>
      )}

      {!isOnboarding && (
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 mb-8 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border text-[14px] font-bold text-text-secondary disabled:opacity-50"
        >
          <Download size={15} /> {exporting ? "Exporting…" : "Export Data to CSV"}
        </button>
      )}
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted";

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-bold text-text-secondary">{label}</label>
      {children}
    </div>
  );
}
