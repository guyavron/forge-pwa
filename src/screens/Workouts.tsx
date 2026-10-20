import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { UndoToast } from "@/components/ui/UndoToast";
import {
  createWorkout,
  deleteWorkout,
  getExerciseLogsForWorkout,
  getExerciseLogsForWorkouts,
  getPreviousBestForExercise,
  getWorkoutsForDate,
  getWorkoutsForDateRange,
  restoreWorkout,
} from "@/lib/api";
import { dayKey, formatDuration, formatShortDate } from "@/lib/dateHelpers";
import { LoadError } from "@/components/ui/LoadError";
import { useToday } from "@/lib/useToday";
import type { ExerciseLogRow, WorkoutRow, WorkoutType } from "@/types/database";

const WORKOUT_TYPES: { value: WorkoutType; label: string }[] = [
  { value: "Gym", label: "Gym / Strength" },
  { value: "Bouldering", label: "Bouldering / Climbing" },
  { value: "Running", label: "Running" },
  { value: "Cardio", label: "Cardio" },
  { value: "Cycling", label: "Cycling" },
  { value: "Swimming", label: "Swimming" },
  { value: "Other", label: "Other" },
];

const STRENGTH_TYPES: WorkoutType[] = ["Gym", "Bouldering"];

interface DraftExercise {
  id: string;
  exercise_name: string;
  sets: string;
  reps: string;
  weight_kg: string;
}

function emptyExercise(): DraftExercise {
  return { id: crypto.randomUUID(), exercise_name: "", sets: "", reps: "", weight_kg: "" };
}

interface OverloadResult {
  exerciseName: string;
  previousBestWeight: number | null;
  currentBestWeight: number | null;
  improved: boolean;
}

export function Workouts() {
  const [workoutType, setWorkoutType] = useState<WorkoutType>("Gym");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<DraftExercise[]>([emptyExercise()]);
  const [saving, setSaving] = useState(false);

  const [todaysWorkouts, setTodaysWorkouts] = useState<WorkoutRow[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, ExerciseLogRow[]>>({});
  const [overloadResults, setOverloadResults] = useState<OverloadResult[] | null>(null);
  const [undoWorkout, setUndoWorkout] = useState<{ workout: WorkoutRow; exerciseLogs: ExerciseLogRow[] } | null>(null);

  const [loadError, setLoadError] = useState(false);
  const [recent, setRecent] = useState<WorkoutRow[] | null>(null);
  const [recentLogs, setRecentLogs] = useState<Record<string, ExerciseLogRow[]>>({});
  const [recentError, setRecentError] = useState(false);
  const today = useToday();

  const isStrength = STRENGTH_TYPES.includes(workoutType);

  const loadToday = () => {
    setLoadError(false);
    getWorkoutsForDate(today)
      .then(async (workouts) => {
        setTodaysWorkouts(workouts);
        const strengthWorkouts = workouts.filter((w) => STRENGTH_TYPES.includes(w.workout_type as WorkoutType));
        const entries = await Promise.all(
          strengthWorkouts.map(async (w) => [w.id, await getExerciseLogsForWorkout(w.id)] as const)
        );
        setExerciseLogs(Object.fromEntries(entries));
      })
      .catch((err) => {
        console.error(err);
        setLoadError(true);
      });
  };

  useEffect(loadToday, [today]);

  // The last 7 completed days, so you can see what you lifted last time *before* training,
  // not only in the "Progress made!" check after saving. Quick "steps" entries are left out.
  const loadRecent = () => {
    setRecentError(false);
    const shift = (n: number) => {
      const d = new Date(`${today}T12:00:00`);
      d.setDate(d.getDate() + n);
      return dayKey(d);
    };
    getWorkoutsForDateRange(shift(-7), shift(-1))
      .then(async (rows) => {
        const sessions = rows.filter((w) => !(w.workout_type === "Other" && w.duration_minutes === 0));
        const strengthIds = sessions.filter((w) => STRENGTH_TYPES.includes(w.workout_type as WorkoutType)).map((w) => w.id);
        setRecentLogs(await getExerciseLogsForWorkouts(strengthIds));
        setRecent(sessions);
      })
      .catch((err) => {
        console.error(err);
        setRecentError(true);
      });
  };

  useEffect(loadRecent, [today]);

  const resetForm = () => {
    setWorkoutType("Gym");
    setDuration("");
    setCalories("");
    setHeartRate("");
    setNotes("");
    setExercises([emptyExercise()]);
  };

  const updateExercise = (id: string, patch: Partial<DraftExercise>) => {
    setExercises((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeExercise = (id: string) => {
    setExercises((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  };

  const handleSubmit = async () => {
    const durationMinutes = Number(duration);
    if (!durationMinutes || durationMinutes <= 0 || durationMinutes > 1440) {
      alert("Enter a duration between 1 and 1440 minutes.");
      return;
    }
    // A negative calorie value would silently shrink the day's calorie target.
    if (calories && !(Number(calories) >= 0 && Number(calories) <= 5000)) {
      alert("Calories must be between 0 and 5000.");
      return;
    }
    if (heartRate && !(Number(heartRate) >= 30 && Number(heartRate) <= 250)) {
      alert("Average heart rate must be between 30 and 250 bpm.");
      return;
    }
    const badSet = isStrength && exercises.some((e) => [e.sets, e.reps, e.weight_kg].some((v) => v !== "" && !(Number(v) >= 0)));
    if (badSet) {
      alert("Sets, reps and weight can't be negative.");
      return;
    }

    setSaving(true);
    try {
      const namedExercises = isStrength
        ? exercises
            .filter((e) => e.exercise_name.trim())
            .map((e) => ({
              exercise_name: e.exercise_name.trim(),
              sets: e.sets ? Number(e.sets) : null,
              reps: e.reps ? Number(e.reps) : null,
              weight_kg: e.weight_kg ? Number(e.weight_kg) : null,
            }))
        : [];

      const beforeDate = new Date().toISOString();

      // Compare against history before inserting the new session, so it doesn't compare
      // against itself.
      const comparisons: OverloadResult[] = [];
      for (const ex of namedExercises) {
        if (ex.weight_kg == null) continue;
        const previous = await getPreviousBestForExercise(ex.exercise_name, beforeDate);
        const previousBestWeight = previous
          ? previous.reduce<number | null>((best, s) => (s.weight_kg != null && (best == null || s.weight_kg > best) ? s.weight_kg : best), null)
          : null;
        comparisons.push({
          exerciseName: ex.exercise_name,
          previousBestWeight,
          currentBestWeight: ex.weight_kg,
          improved: previousBestWeight != null && ex.weight_kg > previousBestWeight,
        });
      }

      await createWorkout({
        workout_type: workoutType,
        duration_minutes: durationMinutes,
        calories_burned: calories ? Number(calories) : null,
        heart_rate_avg: heartRate ? Number(heartRate) : null,
        notes: notes.trim() || null,
        exercises: namedExercises,
      });

      resetForm();
      loadToday();
      if (comparisons.length > 0) setOverloadResults(comparisons);
    } catch (err) {
      console.error(err);
      alert("Couldn't save that workout — check the console for details.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (workout: WorkoutRow) => {
    try {
      const logs = exerciseLogs[workout.id] ?? [];
      await deleteWorkout(workout.id);
      loadToday();
      setUndoWorkout({ workout, exerciseLogs: logs });
    } catch (err) {
      console.error(err);
      alert("Couldn't delete that workout.");
    }
  };

  const handleUndoDelete = async () => {
    const pending = undoWorkout;
    if (!pending) return;
    setUndoWorkout(null);
    try {
      await restoreWorkout(pending.workout, pending.exerciseLogs);
      loadToday();
    } catch (err) {
      console.error("Couldn't restore that workout:", err);
      alert("Couldn't restore that workout.");
    }
  };

  return (
    <div className="px-4 pt-3">
      <h1 className="mb-4 text-2xl font-extrabold text-text-primary">Log Workout</h1>

      <Card className="mb-4">
        <label className="mb-2 block text-xs font-bold text-text-secondary">Activity Type</label>
        <div className="mb-4 flex flex-wrap gap-2">
          {WORKOUT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setWorkoutType(t.value)}
              className={`min-h-9 rounded-lg border px-3 text-[12.5px] font-semibold ${
                workoutType === t.value
                  ? "border-accent bg-accent-muted text-accent"
                  : "border-border bg-surface-elevated text-text-secondary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-xs font-bold text-text-secondary">Duration (min)</label>
            <input
              type="number"
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="45"
              className="min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold text-text-secondary">Calories</label>
            <input
              type="number"
              inputMode="decimal"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              placeholder="Optional"
              className="min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-2 block text-xs font-bold text-text-secondary">Avg Heart Rate (bpm)</label>
          <input
            type="number"
            inputMode="numeric"
            value={heartRate}
            onChange={(e) => setHeartRate(e.target.value)}
            placeholder="Optional"
            className="min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted"
          />
        </div>

        {isStrength && (
          <div className="mb-4">
            <label className="mb-2 block text-xs font-bold text-text-secondary">Exercises</label>
            {exercises.map((ex) => (
              <div key={ex.id} className="mb-2.5 rounded-xl border border-border bg-surface-elevated p-3">
                <div className="mb-2.5 flex items-center gap-2">
                  <input
                    type="text"
                    value={ex.exercise_name}
                    onChange={(e) => updateExercise(ex.id, { exercise_name: e.target.value })}
                    placeholder="Exercise name (e.g. Bench Press)"
                    className="min-h-9 flex-1 border-0 border-b border-border bg-transparent text-sm font-semibold text-text-primary placeholder:font-normal placeholder:text-text-muted focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeExercise(ex.id)}
                    className="flex h-8 w-8 flex-none items-center justify-center text-text-muted"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={ex.sets}
                    onChange={(e) => updateExercise(ex.id, { sets: e.target.value })}
                    placeholder="Sets"
                    className="min-h-10 rounded-lg border border-border bg-surface px-2 text-center text-sm text-text-primary placeholder:text-text-muted"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    value={ex.reps}
                    onChange={(e) => updateExercise(ex.id, { reps: e.target.value })}
                    placeholder="Reps"
                    className="min-h-10 rounded-lg border border-border bg-surface px-2 text-center text-sm text-text-primary placeholder:text-text-muted"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    value={ex.weight_kg}
                    onChange={(e) => updateExercise(ex.id, { weight_kg: e.target.value })}
                    placeholder="kg"
                    className="min-h-10 rounded-lg border border-border bg-surface px-2 text-center text-sm text-text-primary placeholder:text-text-muted"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setExercises((rows) => [...rows, emptyExercise()])}
              className="min-h-11 w-full rounded-xl border border-dashed border-border text-[13px] font-bold text-text-secondary"
            >
              + Add Exercise
            </button>
          </div>
        )}

        <div className="mb-4">
          <label className="mb-2 block text-xs font-bold text-text-secondary">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
            rows={2}
            className="w-full resize-none rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-text-primary placeholder:text-text-muted"
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="min-h-12 w-full rounded-xl bg-accent text-[15px] font-extrabold text-background disabled:opacity-50"
        >
          {saving ? "Saving…" : "Log Workout"}
        </button>
      </Card>

      <h2 className="mb-3 text-[17px] font-bold text-text-primary">Today's Training</h2>
      {loadError && <LoadError onRetry={loadToday} />}
      <Card className="mb-6">
        {loadError ? (
          <p className="py-2 text-[13px] text-text-muted">—</p>
        ) : todaysWorkouts.length === 0 ? (
          <p className="py-2 text-[13px] text-text-muted">No workouts logged yet today.</p>
        ) : (
          todaysWorkouts.map((w) => (
            <div key={w.id} className="border-b border-border py-2.5 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary">{w.workout_type}</p>
                  <p className="text-xs text-text-muted">
                    {w.duration_minutes ? `${formatDuration(w.duration_minutes)} · ` : ""}
                    {w.calories_burned ? `${Math.round(w.calories_burned)} kcal` : ""}
                    {w.heart_rate_avg ? ` · ${w.heart_rate_avg} bpm avg` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(w)}
                  className="flex h-11 w-11 flex-none items-center justify-center text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              {exerciseLogs[w.id]?.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {exerciseLogs[w.id].map((log) => (
                    <p key={log.id} className="text-[11px] text-text-muted">
                      {log.exercise_name}
                      {log.sets ? ` · ${log.sets} sets` : ""}
                      {log.reps ? ` x ${log.reps}` : ""}
                      {log.weight_kg ? ` @ ${log.weight_kg}kg` : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </Card>

      <h2 className="mb-3 text-[17px] font-bold text-text-primary">Recent Sessions</h2>
      {recentError && <LoadError onRetry={loadRecent} />}
      <Card className="mb-6">
        {recentError ? (
          <p className="py-2 text-[13px] text-text-muted">—</p>
        ) : recent === null ? (
          <p className="py-2 text-[13px] text-text-muted">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="py-2 text-[13px] text-text-muted">No workouts in the last 7 days.</p>
        ) : (
          recent.map((w) => (
            <div key={w.id} className="border-b border-border py-2.5 last:border-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">{w.workout_type}</p>
                <span className="flex-none text-[11px] text-text-muted">{formatShortDate(w.workout_date)}</span>
              </div>
              <p className="text-xs text-text-muted">
                {w.duration_minutes ? `${formatDuration(w.duration_minutes)}` : ""}
                {w.calories_burned ? ` · ${Math.round(w.calories_burned)} kcal` : ""}
                {w.heart_rate_avg ? ` · ${w.heart_rate_avg} bpm avg` : ""}
              </p>
              {recentLogs[w.id]?.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {recentLogs[w.id].map((log) => (
                    <p key={log.id} className="text-[11px] text-text-muted">
                      {log.exercise_name}
                      {log.sets ? ` · ${log.sets} sets` : ""}
                      {log.reps ? ` x ${log.reps}` : ""}
                      {log.weight_kg ? ` @ ${log.weight_kg}kg` : ""}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </Card>

      {overloadResults && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-6">
          <div className="max-h-[85dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-border bg-surface p-6 [-webkit-overflow-scrolling:touch]">
            <p className="mb-1 text-center text-3xl">{overloadResults.some((r) => r.improved) ? "💪" : "📊"}</p>
            <h3 className="text-center text-lg font-extrabold text-text-primary">
              {overloadResults.some((r) => r.improved) ? "Progress made!" : "Session logged"}
            </h3>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {overloadResults.map((r) => (
                <div key={r.exerciseName} className="rounded-xl bg-surface-elevated p-3">
                  <p className="mb-1 text-sm font-bold text-text-primary">{r.exerciseName}</p>
                  {r.previousBestWeight == null ? (
                    <p className="text-xs text-text-muted">First time logging this exercise</p>
                  ) : (
                    <p className={`text-xs font-semibold ${r.improved ? "text-success" : "text-text-secondary"}`}>
                      {r.previousBestWeight}kg &rarr; {r.currentBestWeight}kg {r.improved ? "↑" : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOverloadResults(null)}
              className="mt-5 min-h-12 w-full rounded-xl bg-accent text-[15px] font-extrabold text-background"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {undoWorkout && (
        <UndoToast
          message="Item deleted."
          onUndo={handleUndoDelete}
          onExpire={() => setUndoWorkout(null)}
        />
      )}
    </div>
  );
}
