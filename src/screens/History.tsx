import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getExerciseLogsForWorkout, getMealsForDate, getMealsForDateRange, getWorkoutsForDate, getWorkoutsForDateRange } from "@/lib/api";
import { dayKey, formatDuration } from "@/lib/dateHelpers";
import type { ExerciseLogRow, MealRow, ProfileRow, WorkoutRow } from "@/types/database";

const STRENGTH_TYPES = ["Gym", "Bouldering"];

type ViewMode = "daily" | "weekly" | "monthly";

function dayKeyOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return dayKey(d);
}

export function History({ profile }: { profile: ProfileRow }) {
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [selectedDay, setSelectedDay] = useState(dayKey());

  return (
    <div className="px-4 pt-3">
      <h1 className="mb-4 text-2xl font-extrabold text-text-primary">History</h1>

      <div className="mb-4 flex rounded-xl border border-border bg-surface-elevated p-1">
        {(["daily", "weekly", "monthly"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`min-h-9 flex-1 rounded-lg text-[12.5px] font-bold capitalize ${
              viewMode === mode ? "bg-accent text-background" : "text-text-secondary"
            }`}
          >
            {mode === "daily" ? "Daily" : mode === "weekly" ? "Weekly Summary" : "Monthly Summary"}
          </button>
        ))}
      </div>

      {viewMode === "daily" ? (
        <DailyView profile={profile} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
      ) : (
        <SummaryView profile={profile} days={viewMode === "weekly" ? 7 : 30} />
      )}
    </div>
  );
}

function DailyView({
  profile,
  selectedDay,
  onSelectDay,
}: {
  profile: ProfileRow;
  selectedDay: string;
  onSelectDay: (day: string) => void;
}) {
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [workouts, setWorkouts] = useState<WorkoutRow[]>([]);
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, ExerciseLogRow[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getMealsForDate(selectedDay), getWorkoutsForDate(selectedDay)])
      .then(async ([m, w]) => {
        setMeals(m);
        setWorkouts(w);
        const strengthWorkouts = w.filter((wo) => STRENGTH_TYPES.includes(wo.workout_type));
        const entries = await Promise.all(
          strengthWorkouts.map(async (wo) => [wo.id, await getExerciseLogsForWorkout(wo.id)] as const)
        );
        setExerciseLogs(Object.fromEntries(entries));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedDay]);

  const shiftDay = (delta: number) => {
    const d = new Date(`${selectedDay}T00:00:00`);
    d.setDate(d.getDate() + delta);
    onSelectDay(dayKey(d));
  };

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein_g: acc.protein_g + (m.protein_g ?? 0),
      carbs_g: acc.carbs_g + (m.carbs_g ?? 0),
      fat_g: acc.fat_g + (m.fat_g ?? 0),
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  );
  const caloriesBurned = workouts.reduce((sum, w) => sum + (w.calories_burned ?? 0), 0);
  const dynamicTarget = (profile.daily_calorie_target ?? 0) + caloriesBurned;
  const netBalance = Math.round(totals.calories - dynamicTarget);
  const isToday = selectedDay === dayKey();

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => shiftDay(-1)}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-border text-text-secondary"
        >
          <ChevronLeft size={18} />
        </button>
        <input
          type="date"
          value={selectedDay}
          max={dayKey()}
          onChange={(e) => e.target.value && onSelectDay(e.target.value)}
          className="min-h-11 flex-1 rounded-xl border border-border bg-surface-elevated px-3 text-center text-text-primary"
        />
        <button
          type="button"
          onClick={() => shiftDay(1)}
          disabled={isToday}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-border text-text-secondary disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <p className="py-6 text-center text-[13px] text-text-muted">Loading…</p>
      ) : (
        <>
          <Card className="mb-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-2xl font-extrabold text-text-primary">{Math.round(totals.calories)} kcal</p>
                <p className="mt-0.5 text-xs text-text-muted">Target {Math.round(dynamicTarget)} kcal</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-extrabold ${netBalance > 0 ? "text-warning" : "text-success"}`}>
                  {netBalance > 0 ? "+" : ""}
                  {netBalance}
                </p>
                <p className="text-xs text-text-muted">{netBalance > 0 ? "surplus" : "deficit"}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
              <div>
                <p className="text-sm font-bold text-protein">{Math.round(totals.protein_g)}g</p>
                <p className="text-[10.5px] text-text-muted">Protein</p>
              </div>
              <div>
                <p className="text-sm font-bold text-carbs">{Math.round(totals.carbs_g)}g</p>
                <p className="text-[10.5px] text-text-muted">Carbs</p>
              </div>
              <div>
                <p className="text-sm font-bold text-fat">{Math.round(totals.fat_g)}g</p>
                <p className="text-[10.5px] text-text-muted">Fat</p>
              </div>
            </div>
          </Card>

          <SectionHeading title="Meals" />
          <Card className="mb-4">
            {meals.length === 0 ? (
              <p className="py-2 text-[13px] text-text-muted">Nothing logged this day.</p>
            ) : (
              meals.map((m) => (
                <div key={m.id} className="border-b border-border py-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-primary">{m.food_name}</p>
                    <span className="text-[11px] font-bold text-text-muted">{m.meal_category}</span>
                  </div>
                  <p className="text-xs text-text-muted">
                    {Math.round(m.calories ?? 0)} kcal · P{Math.round(m.protein_g ?? 0)} C{Math.round(m.carbs_g ?? 0)} F{Math.round(m.fat_g ?? 0)}
                  </p>
                </div>
              ))
            )}
          </Card>

          <SectionHeading title="Workouts" />
          <Card>
            {workouts.length === 0 ? (
              <p className="py-2 text-[13px] text-text-muted">No workouts logged this day.</p>
            ) : (
              workouts.map((w) => (
                <div key={w.id} className="border-b border-border py-2.5 last:border-0">
                  <p className="text-sm font-semibold text-text-primary">{w.workout_type}</p>
                  <p className="text-xs text-text-muted">
                    {w.duration_minutes ? `${formatDuration(w.duration_minutes)} · ` : ""}
                    {w.calories_burned ? `${Math.round(w.calories_burned)} kcal` : ""}
                    {w.heart_rate_avg ? ` · ${w.heart_rate_avg} bpm avg` : ""}
                  </p>
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
        </>
      )}
    </>
  );
}

interface DaySummary {
  day: string;
  calories: number;
  protein: number;
  caloriesBurned: number;
  dynamicTarget: number;
}

/** A day "meets goal" if it has any logging and lands within 10% of that day's dynamic
 *  calorie target (base target + active calories burned that day) — a simple adherence band
 *  rather than requiring an exact hit. */
const ADHERENCE_BAND = 0.1;

function SummaryView({ profile, days }: { profile: ProfileRow; days: number }) {
  const [daySummaries, setDaySummaries] = useState<DaySummary[] | null>(null);

  useEffect(() => {
    setDaySummaries(null);
    const endDay = dayKeyOffset(0);
    const startDay = dayKeyOffset(-(days - 1));

    Promise.all([getMealsForDateRange(startDay, endDay), getWorkoutsForDateRange(startDay, endDay)])
      .then(([meals, workouts]) => {
        const caloriesByDay = new Map<string, number>();
        const proteinByDay = new Map<string, number>();
        for (const m of meals) {
          const key = dayKey(new Date(m.consumed_at));
          caloriesByDay.set(key, (caloriesByDay.get(key) ?? 0) + (m.calories ?? 0));
          proteinByDay.set(key, (proteinByDay.get(key) ?? 0) + (m.protein_g ?? 0));
        }
        const burnedByDay = new Map<string, number>();
        for (const w of workouts) {
          const key = dayKey(new Date(w.workout_date));
          burnedByDay.set(key, (burnedByDay.get(key) ?? 0) + (w.calories_burned ?? 0));
        }

        const baseTarget = profile.daily_calorie_target ?? 0;
        const summaries: DaySummary[] = [];
        for (let i = 0; i < days; i++) {
          const day = dayKeyOffset(-i);
          if (!caloriesByDay.has(day)) continue; // only count days that were actually logged
          const caloriesBurned = burnedByDay.get(day) ?? 0;
          summaries.push({
            day,
            calories: caloriesByDay.get(day) ?? 0,
            protein: proteinByDay.get(day) ?? 0,
            caloriesBurned,
            dynamicTarget: baseTarget + caloriesBurned,
          });
        }
        setDaySummaries(summaries);
      })
      .catch(console.error);
  }, [profile.daily_calorie_target, days]);

  if (daySummaries === null) {
    return <p className="py-6 text-center text-[13px] text-text-muted">Loading…</p>;
  }

  if (daySummaries.length === 0) {
    return (
      <Card>
        <p className="py-2 text-center text-[13px] text-text-muted">
          Nothing logged in the last {days} days yet.
        </p>
      </Card>
    );
  }

  const loggedDays = daySummaries.length;
  const avgCalories = daySummaries.reduce((s, d) => s + d.calories, 0) / loggedDays;
  const avgProtein = daySummaries.reduce((s, d) => s + d.protein, 0) / loggedDays;
  const avgTarget = daySummaries.reduce((s, d) => s + d.dynamicTarget, 0) / loggedDays;
  const netBalanceTotal = Math.round(daySummaries.reduce((s, d) => s + (d.calories - d.dynamicTarget), 0));
  const daysMetGoal = daySummaries.filter((d) => Math.abs(d.calories - d.dynamicTarget) <= d.dynamicTarget * ADHERENCE_BAND).length;

  return (
    <>
      <Card className="mb-4">
        <p className="mb-3 text-xs font-semibold text-text-secondary">
          Based on {loggedDays} logged day{loggedDays === 1 ? "" : "s"} out of the last {days}.
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xl font-extrabold text-text-primary">{Math.round(avgCalories)}</p>
            <p className="text-[11px] text-text-muted">avg kcal / day (target {Math.round(avgTarget)})</p>
          </div>
          <div>
            <p className="text-xl font-extrabold text-protein">{Math.round(avgProtein)}g</p>
            <p className="text-[11px] text-text-muted">avg protein / day (target {profile.daily_protein_target ?? 0}g)</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3.5">
          <div>
            <p className="text-xl font-extrabold text-text-primary">
              {daysMetGoal} / {loggedDays} <span className="text-base">🔥</span>
            </p>
            <p className="text-[11px] text-text-muted">days met goal</p>
          </div>
          <div>
            <p className={`text-xl font-extrabold ${netBalanceTotal > 0 ? "text-warning" : "text-success"}`}>
              {netBalanceTotal > 0 ? "+" : ""}
              {netBalanceTotal}
            </p>
            <p className="text-[11px] text-text-muted">net balance ({netBalanceTotal > 0 ? "surplus" : "deficit"})</p>
          </div>
        </div>
      </Card>

      <SectionHeading title="Day by Day" />
      <Card>
        {[...daySummaries].reverse().map((d) => {
          const diff = Math.round(d.calories - d.dynamicTarget);
          const met = Math.abs(diff) <= d.dynamicTarget * ADHERENCE_BAND;
          return (
            <div key={d.day} className="flex items-center justify-between border-b border-border py-2 last:border-0">
              <div>
                <p className="text-[13px] font-semibold text-text-primary">{d.day}</p>
                <p className="text-[11px] text-text-muted">
                  {Math.round(d.calories)} / {Math.round(d.dynamicTarget)} kcal
                </p>
              </div>
              <span className={`text-[11px] font-bold ${met ? "text-success" : "text-text-muted"}`}>
                {met ? "Met goal" : diff > 0 ? `+${diff}` : diff}
              </span>
            </div>
          );
        })}
      </Card>
    </>
  );
}
