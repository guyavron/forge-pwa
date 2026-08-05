import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getMealsForDate, getWorkoutsForDate, getLatestSleepLog } from "@/lib/api";
import { dayKey, formatDuration } from "@/lib/dateHelpers";
import type { MealRow, ProfileRow, SleepLogRow, WorkoutRow } from "@/types/database";

export function Dashboard({ profile }: { profile: ProfileRow }) {
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [sleep, setSleep] = useState<SleepLogRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = dayKey();
    Promise.all([getMealsForDate(today), getWorkoutsForDate(today), getLatestSleepLog()])
      .then(([m, w, s]) => {
        setMeals(m);
        setWorkouts(w);
        setSleep(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const calories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
  const protein = meals.reduce((sum, m) => sum + (m.protein_g ?? 0), 0);
  const totalCaloriesBurned = workouts.reduce((sum, w) => sum + (w.calories_burned ?? 0), 0);
  const totalMinutes = workouts.reduce((sum, w) => sum + (w.duration_minutes ?? 0), 0);

  return (
    <div className="px-4 pt-3">
      <h1 className="mb-0.5 text-2xl font-extrabold text-text-primary">Welcome back</h1>
      <p className="mb-4 text-sm text-text-secondary">
        {profile.current_weight ?? "—"}kg &rarr; {profile.target_weight ?? "—"}kg
        {profile.fitness_goal ? ` · ${profile.fitness_goal}` : ""}
      </p>

      <Card className="mb-4">
        <ProgressBar
          label="Calories"
          consumed={calories}
          target={profile.daily_calorie_target ?? 0}
          unit=" kcal"
          colorClassName="bg-accent"
        />
        <ProgressBar
          label="Protein"
          consumed={protein}
          target={profile.daily_protein_target ?? 0}
          colorClassName="bg-protein"
        />
      </Card>

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
                  {formatDuration(w.duration_minutes ?? 0)}
                  {w.calories_burned ? ` · ${Math.round(w.calories_burned)} kcal` : ""}
                  {w.heart_rate_avg ? ` · ${w.heart_rate_avg} bpm avg` : ""}
                </p>
              </div>
            </div>
          ))
        )}
      </Card>

      <SectionHeading title="Sleep" />
      <Card className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-2xl font-extrabold text-text-primary">
            {sleep?.sleep_hours != null ? `${sleep.sleep_hours}h` : "No data"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            {sleep ? `Logged ${sleep.log_date}` : "No sleep_logs rows yet"}
          </p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-muted">
          <Moon size={20} className="text-sleep" />
        </div>
      </Card>
    </div>
  );
}
