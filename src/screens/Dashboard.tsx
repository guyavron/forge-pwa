import { useEffect, useState } from "react";
import { Droplet, Flame, Footprints, Moon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { LogSleepModal } from "@/components/sleep/LogSleepModal";
import { SleepDetailModal } from "@/components/sleep/SleepDetailModal";
import {
  DAILY_WATER_GOAL_ML,
  addWaterLog,
  getLoggingStreak,
  getMealsForDate,
  getSleepLogForDate,
  getWaterForDate,
  getWorkoutsForDate,
  logActiveCalorieBurn,
} from "@/lib/api";
import { dayKey, formatDuration } from "@/lib/dateHelpers";
import { formatHrMinLabel } from "@/lib/sleepStages";
import type { MealRow, ProfileRow, SleepLogRow, WaterLogRow, WorkoutRow } from "@/types/database";

// Matches exactly how logActiveCalorieBurn() creates its workout row — lets the dashboard
// separate "real" logged workouts from quick steps/daily-movement entries for the breakdown.
function isStepsEntry(w: WorkoutRow): boolean {
  return w.workout_type === "Other" && w.duration_minutes === 0;
}

export function Dashboard({ profile }: { profile: ProfileRow }) {
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [sleep, setSleep] = useState<SleepLogRow | null>(null);
  const [water, setWater] = useState<WaterLogRow[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loggingWater, setLoggingWater] = useState(false);
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [showSleepDetail, setShowSleepDetail] = useState(false);
  const [showLogSleep, setShowLogSleep] = useState(false);

  const today = dayKey();

  const loadAll = () => {
    Promise.all([
      getMealsForDate(today),
      getWorkoutsForDate(today),
      getSleepLogForDate(today),
      getWaterForDate(today),
      getLoggingStreak(),
    ])
      .then(([m, w, s, wa, st]) => {
        setMeals(m);
        setWorkouts(w);
        setSleep(s);
        setWater(wa);
        setStreak(st);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(loadAll, []);

  const handleAddWater = async (amountMl: number) => {
    setLoggingWater(true);
    try {
      await addWaterLog(amountMl, today);
      const updated = await getWaterForDate(today);
      setWater(updated);
    } catch (err) {
      console.error(err);
      alert("Couldn't log water.");
    } finally {
      setLoggingWater(false);
    }
  };

  const calories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const protein = meals.reduce((sum, m) => sum + (m.protein_g ?? 0), 0);
  const workoutsBurned = workouts.filter((w) => !isStepsEntry(w)).reduce((sum, w) => sum + (w.calories_burned ?? 0), 0);
  const stepsBurned = workouts.filter(isStepsEntry).reduce((sum, w) => sum + (w.calories_burned ?? 0), 0);
  const totalCaloriesBurned = workoutsBurned + stepsBurned;
  const totalMinutes = workouts.reduce((sum, w) => sum + (w.duration_minutes ?? 0), 0);
  const waterMl = water.reduce((sum, w) => sum + w.amount_ml, 0);

  // Dynamic Target = Base Target + Workouts + Steps/Daily Movement, per the workout-budgeting spec.
  const baseCalorieTarget = profile.daily_calorie_target ?? 0;
  const dynamicCalorieTarget = baseCalorieTarget + totalCaloriesBurned;

  return (
    <div className="px-4 pt-3">
      <div className="mb-0.5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-text-primary">Welcome back</h1>
        {streak > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-extrabold text-warning">
            <Flame size={13} /> {streak} day{streak === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-text-secondary">
        {profile.current_weight ?? "—"}kg &rarr; {profile.target_weight ?? "—"}kg
        {profile.fitness_goal ? ` · ${profile.fitness_goal.replace("_", " ")}` : ""}
      </p>

      <Card className="mb-4">
        <ProgressBar
          label="Calories"
          consumed={calories}
          target={dynamicCalorieTarget}
          unit=" kcal"
          colorClassName="bg-accent"
          showPercent
          badge={
            totalCaloriesBurned > 0 ? (
              <span className="rounded-full bg-accent-muted px-1.5 py-0.5 text-[10px] font-bold text-accent">
                +{Math.round(totalCaloriesBurned)} active kcal
              </span>
            ) : undefined
          }
        />
        {totalCaloriesBurned > 0 && (
          <p className="-mt-2.5 mb-3.5 text-[10.5px] text-text-muted">
            Target: {Math.round(baseCalorieTarget)} base
            {workoutsBurned > 0 ? ` + ${Math.round(workoutsBurned)} workouts` : ""}
            {stepsBurned > 0 ? ` + ${Math.round(stepsBurned)} daily movement` : ""}
            {` = ${Math.round(dynamicCalorieTarget)} kcal`}
          </p>
        )}
        <ProgressBar
          label="Protein"
          consumed={protein}
          target={profile.daily_protein_target ?? 0}
          colorClassName="bg-protein"
          showPercent
        />
      </Card>

      <button
        type="button"
        onClick={() => setShowBurnModal(true)}
        className="mb-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent/50 bg-accent-muted text-[13px] font-extrabold text-accent"
      >
        <Footprints size={15} /> + Steps & Daily Movement
      </button>

      <SectionHeading title="Today's Training" right={<span className="text-[13px] tabular-nums text-text-secondary">{formatDuration(totalMinutes)} · {Math.round(totalCaloriesBurned)} kcal</span>} />
      <Card className="mb-4">
        {loading ? (
          <p className="py-2 text-[13px] text-text-muted">Loading…</p>
        ) : workouts.length === 0 ? (
          <p className="py-2 text-[13px] text-text-muted">No workouts logged yet today.</p>
        ) : (
          workouts.map((w) => (
            <div key={w.id} className="flex items-center gap-2.5 border-b border-border py-2 last:border-0">
              <span className="h-2 w-2 flex-none rounded-full bg-accent" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary">{w.workout_type}</p>
                <p className="text-xs text-text-muted">
                  {w.duration_minutes ? `${formatDuration(w.duration_minutes)} · ` : ""}
                  {w.calories_burned ? `${Math.round(w.calories_burned)} kcal` : ""}
                  {w.heart_rate_avg ? ` · ${w.heart_rate_avg} bpm avg` : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </Card>

      <SectionHeading title="Water" />
      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-2xl font-extrabold text-text-primary">{waterMl}ml</p>
            <p className="mt-0.5 text-xs text-text-muted">of {DAILY_WATER_GOAL_ML}ml goal</p>
          </div>
          <div className="flex flex-none gap-2">
            <button
              type="button"
              onClick={() => handleAddWater(250)}
              disabled={loggingWater}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent-muted px-3.5 text-[13px] font-bold text-accent disabled:opacity-50"
            >
              <Droplet size={15} /> +250ml
            </button>
            <button
              type="button"
              onClick={() => handleAddWater(500)}
              disabled={loggingWater}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent-muted px-3.5 text-[13px] font-bold text-accent disabled:opacity-50"
            >
              <Droplet size={15} /> +500ml
            </button>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
          <div
            className="h-full rounded-full bg-sleep transition-[width] duration-500"
            style={{ width: `${Math.min(waterMl / DAILY_WATER_GOAL_ML, 1) * 100}%` }}
          />
        </div>
      </Card>

      <SectionHeading title="Sleep" />
      <button
        type="button"
        onClick={() => (sleep ? setShowSleepDetail(true) : setShowLogSleep(true))}
        className="mb-4 flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-4 text-left"
      >
        <div>
          <p className="text-2xl font-extrabold text-text-primary">
            {sleep?.total_asleep_minutes != null ? formatHrMinLabel(sleep.total_asleep_minutes) : "No data"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">{sleep ? "Tap to view breakdown" : "Tap to log last night's sleep"}</p>
        </div>
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent-muted">
          <Moon size={20} className="text-sleep" />
        </div>
      </button>

      {showBurnModal && (
        <ActiveBurnModal
          onClose={() => setShowBurnModal(false)}
          onLogged={() => {
            setShowBurnModal(false);
            loadAll();
          }}
        />
      )}

      {showSleepDetail && sleep && (
        <SleepDetailModal
          log={sleep}
          onClose={() => setShowSleepDetail(false)}
          onEdit={() => {
            setShowSleepDetail(false);
            setShowLogSleep(true);
          }}
        />
      )}

      {showLogSleep && (
        <LogSleepModal
          existing={sleep}
          onClose={() => setShowLogSleep(false)}
          onSaved={() => {
            setShowLogSleep(false);
            loadAll();
          }}
        />
      )}
    </div>
  );
}

function ActiveBurnModal({ onClose, onLogged }: { onClose: () => void; onLogged: () => void }) {
  const [calories, setCalories] = useState("");
  const [saving, setSaving] = useState(false);
  const canSubmit = Number(calories) > 0;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await logActiveCalorieBurn(Math.round(Number(calories)));
      onLogged();
    } catch (err) {
      console.error(err);
      alert("Couldn't log that burn.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-border bg-surface p-6 [-webkit-overflow-scrolling:touch]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-accent-muted">
            <Footprints size={18} className="text-accent" />
          </div>
          <div>
            <h3 className="text-[15px] font-extrabold text-text-primary">Log Steps & Daily Movement</h3>
            <p className="text-[11.5px] text-text-secondary">From Apple Watch or another fitness app</p>
          </div>
        </div>
        <input
          type="number"
          inputMode="numeric"
          autoFocus
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          placeholder="Calories burned"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          className="mb-3 min-h-14 w-full rounded-xl border border-border bg-surface-elevated px-4 text-center text-2xl font-extrabold text-text-primary placeholder:text-base placeholder:font-normal placeholder:text-text-muted"
        />
        <p className="mb-4 text-[11px] leading-snug text-text-muted">
          Enter calories burned from daily walking, steps, and general movement measured by
          your watch. Do NOT include workouts you already logged in the Workouts tab.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-border text-[15px] font-bold text-text-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit || saving}
            className="min-h-12 flex-1 rounded-xl bg-accent text-[15px] font-extrabold text-background disabled:opacity-40"
          >
            {saving ? "Saving…" : "Add to Budget"}
          </button>
        </div>
      </div>
    </div>
  );
}
