import { useState, type ReactNode } from "react";
import { saveProfile } from "@/lib/api";
import type { ProfileRow } from "@/types/database";

const GOALS = ["Muscle Gain", "Weight Gain", "Recomposition", "Maintenance"];

interface ProfileProps {
  profile: ProfileRow | null;
  onSaved: () => void;
  isOnboarding?: boolean;
}

export function Profile({ profile, onSaved, isOnboarding = false }: ProfileProps) {
  const [age, setAge] = useState(profile?.age?.toString() ?? "");
  const [height, setHeight] = useState(profile?.height?.toString() ?? "");
  const [currentWeight, setCurrentWeight] = useState(profile?.current_weight?.toString() ?? "");
  const [targetWeight, setTargetWeight] = useState(profile?.target_weight?.toString() ?? "");
  const [fitnessGoal, setFitnessGoal] = useState(profile?.fitness_goal ?? GOALS[0]);
  const [calorieTarget, setCalorieTarget] = useState(profile?.daily_calorie_target?.toString() ?? "");
  const [proteinTarget, setProteinTarget] = useState(profile?.daily_protein_target?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const canSubmit =
    Number(age) > 0 && Number(height) > 0 && Number(currentWeight) > 0 && Number(targetWeight) > 0 && Number(calorieTarget) > 0 && Number(proteinTarget) > 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      alert("Fill in age, height, both weights, and your calorie/protein targets — all greater than 0.");
      return;
    }
    setSaving(true);
    try {
      await saveProfile(profile?.id ?? null, {
        age: Number(age),
        height: Number(height),
        current_weight: Number(currentWeight),
        target_weight: Number(targetWeight),
        fitness_goal: fitnessGoal,
        daily_calorie_target: Number(calorieTarget),
        daily_protein_target: Number(proteinTarget),
      });
      onSaved();
      if (!isOnboarding) {
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2000);
      }
    } catch (err) {
      console.error(err);
      alert("Couldn't save your profile — check the console for details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`px-4 pt-3 ${isOnboarding ? "flex min-h-dvh flex-col justify-center" : ""}`}>
      <h1 className="mb-1 text-2xl font-extrabold text-text-primary">{isOnboarding ? "Welcome to Forge" : "Profile"}</h1>
      <p className="mb-5 text-sm text-text-secondary">
        {isOnboarding ? "Set up your baseline stats and daily targets to get started." : "Update your stats and daily targets."}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Age">
          <input type="number" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="28" className={inputClass} />
        </Field>
        <Field label="Height (cm)">
          <input type="number" inputMode="decimal" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="178" className={inputClass} />
        </Field>
        <Field label="Current Weight (kg)">
          <input type="number" inputMode="decimal" value={currentWeight} onChange={(e) => setCurrentWeight(e.target.value)} placeholder="75" className={inputClass} />
        </Field>
        <Field label="Target Weight (kg)">
          <input type="number" inputMode="decimal" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="82" className={inputClass} />
        </Field>
      </div>

      <Field label="Fitness Goal" className="mt-3">
        <select value={fitnessGoal} onChange={(e) => setFitnessGoal(e.target.value)} className={inputClass}>
          {GOALS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </Field>

      <div className="mt-3 grid grid-cols-2 gap-3">
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
        className="mt-6 min-h-12 w-full rounded-xl bg-accent text-[15px] font-extrabold text-background disabled:opacity-50"
      >
        {saving ? "Saving…" : isOnboarding ? "Finish Setup" : savedFlash ? "Saved ✓" : "Save Changes"}
      </button>

      {isOnboarding && (
        <p className="mt-4 text-center text-[11.5px] text-text-muted">
          Not sure about your calorie/protein targets yet? Enter a rough estimate — you can always
          update these later from the Profile tab.
        </p>
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
