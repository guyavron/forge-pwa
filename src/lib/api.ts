import { supabase } from "@/lib/supabaseClient";
import { dayBounds, dayKey } from "@/lib/dateHelpers";
import type {
  ExerciseLogRow,
  FavoriteMealRow,
  MealRow,
  ProfileRow,
  SleepLogRow,
  WaterLogRow,
  WorkoutRow,
} from "@/types/database";

/**
 * Thin data-access layer over Supabase — components call these instead of using the raw
 * client directly, so query shape/error handling lives in one place. Multi-user: every query
 * is scoped to the signed-in user's id, both as a defense-in-depth filter and because RLS
 * alone would otherwise return rows for whichever user happens to match — we still rely on
 * RLS as the actual security boundary, this is just so queries don't need a broader select.
 */

async function getCurrentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Not signed in.");
  return data.user.id;
}

async function getCurrentUser(): Promise<{ id: string; email: string | null }> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Not signed in.");
  return { id: data.user.id, email: data.user.email ?? null };
}

// ---------- Profile ----------
//
// `profiles.id` IS the auth user id here (no separate `user_id` FK column is used) — RLS
// checks `auth.uid() = id` directly, and `id` has no default, so every write must supply it.

export async function getProfile(): Promise<ProfileRow | null> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProfile(
  fields: Omit<ProfileRow, "id" | "email" | "created_at" | "updated_at">
): Promise<ProfileRow> {
  const { id, email } = await getCurrentUser();
  const { data, error } = await supabase
    .from("profiles")
    // `updated_at` defaults to now() but that default only fires on INSERT, not on an
    // upsert's ON CONFLICT UPDATE path — set it explicitly so edits actually bump it.
    .upsert({ id, email, updated_at: new Date().toISOString(), ...fields }, { onConflict: "id" })
    .select()
    .single();
  if (error) {
    console.error("saveProfile failed:", { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error;
  }
  return data;
}

// ---------- Workouts + exercise logs ----------

export interface NewExerciseInput {
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
}

export interface NewWorkoutInput {
  workout_type: string;
  duration_minutes: number;
  calories_burned: number | null;
  heart_rate_avg: number | null;
  notes: string | null;
  exercises: NewExerciseInput[];
}

export async function getWorkoutsForDate(day: string): Promise<WorkoutRow[]> {
  const userId = await getCurrentUserId();
  const { start, end } = dayBounds(day);
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .gte("workout_date", start)
    .lt("workout_date", end)
    .order("workout_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getWorkoutsForDateRange(startDay: string, endDay: string): Promise<WorkoutRow[]> {
  const userId = await getCurrentUserId();
  const { start } = dayBounds(startDay);
  const { end } = dayBounds(endDay);
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .gte("workout_date", start)
    .lt("workout_date", end)
    .order("workout_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRecentWorkouts(limit = 10): Promise<WorkoutRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", userId)
    .order("workout_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getExerciseLogsForWorkout(workoutId: string): Promise<ExerciseLogRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("exercise_logs")
    .select("*")
    .eq("workout_id", workoutId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Exercise sets for several workouts in a single request, grouped by workout id. */
export async function getExerciseLogsForWorkouts(workoutIds: string[]): Promise<Record<string, ExerciseLogRow[]>> {
  if (workoutIds.length === 0) return {};
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("exercise_logs")
    .select("*")
    .eq("user_id", userId)
    .in("workout_id", workoutIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const grouped: Record<string, ExerciseLogRow[]> = {};
  for (const log of data ?? []) (grouped[log.workout_id] ??= []).push(log);
  return grouped;
}

/** Creates the workout row, then its exercise_logs rows (if any). Returns the new workout. */
export async function createWorkout(input: NewWorkoutInput): Promise<WorkoutRow> {
  const userId = await getCurrentUserId();
  const { data: workout, error: workoutError } = await supabase
    .from("workouts")
    .insert({
      user_id: userId,
      workout_type: input.workout_type,
      duration_minutes: input.duration_minutes,
      calories_burned: input.calories_burned,
      heart_rate_avg: input.heart_rate_avg,
      notes: input.notes,
    })
    .select()
    .single();
  if (workoutError) throw workoutError;

  const namedExercises = input.exercises.filter((e) => e.exercise_name.trim());
  if (namedExercises.length > 0) {
    const { error: exerciseError } = await supabase
      .from("exercise_logs")
      .insert(namedExercises.map((e) => ({ ...e, workout_id: workout.id, user_id: userId })));
    if (exerciseError) throw exerciseError;
  }

  return workout;
}

/** Quick-entry path for calories burned reported by an outside source (Apple Watch, another
 *  fitness app) with no specific activity logged — recorded as a bare "Other" workout with no
 *  duration so it folds into today's dynamic calorie budget without cluttering the exercise log. */
export async function logActiveCalorieBurn(calories: number): Promise<WorkoutRow> {
  return createWorkout({
    workout_type: "Other",
    duration_minutes: 0,
    calories_burned: calories,
    heart_rate_avg: null,
    notes: "Quick active burn entry",
    exercises: [],
  });
}

export async function deleteWorkout(id: string): Promise<void> {
  // exercise_logs cascade-deletes via the FK's `on delete cascade`.
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) throw error;
}

/** Re-inserts a previously-deleted workout (and its exercise sets) with its original id and
 *  timestamps intact — backs the Undo toast, distinct from createWorkout which mints a new row. */
export async function restoreWorkout(workout: WorkoutRow, exerciseLogs: ExerciseLogRow[]): Promise<void> {
  const { error: workoutError } = await supabase.from("workouts").insert(workout);
  if (workoutError) throw workoutError;
  if (exerciseLogs.length > 0) {
    const { error: exerciseError } = await supabase.from("exercise_logs").insert(exerciseLogs);
    if (exerciseError) throw exerciseError;
  }
}

/** Best weight/reps logged for this exercise name in the most recent workout strictly before
 *  `beforeDate` — used to compute the progressive-overload comparison after saving a session. */
export async function getPreviousBestForExercise(
  exerciseName: string,
  beforeDate: string
): Promise<{ weight_kg: number | null; reps: number | null }[] | null> {
  const userId = await getCurrentUserId();
  const { data: priorWorkout, error: workoutError } = await supabase
    .from("workouts")
    .select("id, workout_date")
    .eq("user_id", userId)
    .lt("workout_date", beforeDate)
    .order("workout_date", { ascending: false })
    .limit(20); // small window of recent workouts to search for a matching exercise name
  if (workoutError) throw workoutError;
  if (!priorWorkout || priorWorkout.length === 0) return null;

  for (const workout of priorWorkout) {
    const { data: sets, error: setsError } = await supabase
      .from("exercise_logs")
      .select("weight_kg, reps")
      .eq("workout_id", workout.id)
      .eq("exercise_name", exerciseName);
    if (setsError) throw setsError;
    if (sets && sets.length > 0) return sets;
  }
  return null;
}

// ---------- Meals ----------

export async function getMealsForDate(day: string): Promise<MealRow[]> {
  const userId = await getCurrentUserId();
  const { start, end } = dayBounds(day);
  const { data, error } = await supabase
    .from("meals")
    .select("*")
    .eq("user_id", userId)
    .gte("consumed_at", start)
    .lt("consumed_at", end)
    .order("consumed_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getMealsForDateRange(startDay: string, endDay: string): Promise<MealRow[]> {
  const userId = await getCurrentUserId();
  const { start } = dayBounds(startDay);
  const { end } = dayBounds(endDay);
  const { data, error } = await supabase
    .from("meals")
    .select("*")
    .eq("user_id", userId)
    .gte("consumed_at", start)
    .lt("consumed_at", end)
    .order("consumed_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export interface NewMealInput {
  meal_category: MealRow["meal_category"];
  food_name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export async function addMeal(input: NewMealInput): Promise<MealRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("meals")
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) throw error;
}

/** Re-inserts a previously-deleted meal with its original id and timestamps intact — backs
 *  the Undo toast, distinct from addMeal which mints a new row/consumed_at. */
export async function restoreMeal(meal: MealRow): Promise<void> {
  const { error } = await supabase.from("meals").insert(meal);
  if (error) throw error;
}

/** Consecutive days (ending today or yesterday) with at least one meal logged. Looks back up
 *  to 60 days, which is generous for a daily-logging habit streak. */
export async function getLoggingStreak(): Promise<number> {
  const userId = await getCurrentUserId();
  const since = new Date();
  since.setDate(since.getDate() - 60);
  const { data, error } = await supabase
    .from("meals")
    .select("consumed_at")
    .eq("user_id", userId)
    .gte("consumed_at", since.toISOString())
    .order("consumed_at", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return 0;

  const loggedDays = new Set(data.map((m) => dayKey(new Date(m.consumed_at))));
  const today = new Date();
  let streak = 0;
  const cursor = new Date(today);

  // If nothing logged today yet, the streak still counts through yesterday.
  if (!loggedDays.has(dayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (loggedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ---------- Favorite meals ----------

export async function getFavoriteMeals(): Promise<FavoriteMealRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("favorite_meals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface NewFavoriteMealInput {
  name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export async function addFavoriteMeal(input: NewFavoriteMealInput): Promise<FavoriteMealRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("favorite_meals")
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) {
    console.error("addFavoriteMeal failed:", { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error;
  }
  return data;
}

export async function deleteFavoriteMeal(id: string): Promise<void> {
  const { error } = await supabase.from("favorite_meals").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Water ----------

const DAILY_WATER_GOAL_ML = 2500;
export { DAILY_WATER_GOAL_ML };

export async function getWaterForDate(day: string): Promise<WaterLogRow[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("water_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", day)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function addWaterLog(amountMl: number, day: string): Promise<WaterLogRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("water_logs")
    .insert({ user_id: userId, amount_ml: amountMl, log_date: day })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---------- Sleep ----------

export async function getSleepLogForDate(day: string): Promise<SleepLogRow | null> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("sleep_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", day)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export interface SaveSleepLogInput {
  log_date: string;
  total_asleep_minutes: number;
  awake_minutes: number;
  rem_minutes: number;
  core_minutes: number;
  deep_minutes: number;
  bedtime: string | null;
  wake_time: string | null;
}

/** One row per user per day — re-logging the same date overwrites via the (user_id, log_date)
 *  unique constraint rather than creating duplicates. */
export async function saveSleepLog(input: SaveSleepLogInput): Promise<SleepLogRow> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("sleep_logs")
    .upsert({ ...input, user_id: userId }, { onConflict: "user_id,log_date" })
    .select()
    .single();
  if (error) {
    console.error("saveSleepLog failed:", { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw error;
  }
  return data;
}

// ---------- Export ----------

export interface ExportBundle {
  meals: MealRow[];
  workouts: WorkoutRow[];
  exerciseLogs: ExerciseLogRow[];
}

/** Pulls everything the signed-in user has ever logged, for the CSV export in Profile. */
export async function getAllDataForExport(): Promise<ExportBundle> {
  const userId = await getCurrentUserId();
  const [mealsRes, workoutsRes, exerciseLogsRes] = await Promise.all([
    supabase.from("meals").select("*").eq("user_id", userId).order("consumed_at", { ascending: true }),
    supabase.from("workouts").select("*").eq("user_id", userId).order("workout_date", { ascending: true }),
    supabase.from("exercise_logs").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
  ]);
  if (mealsRes.error) throw mealsRes.error;
  if (workoutsRes.error) throw workoutsRes.error;
  if (exerciseLogsRes.error) throw exerciseLogsRes.error;
  return {
    meals: mealsRes.data ?? [],
    workouts: workoutsRes.data ?? [],
    exerciseLogs: exerciseLogsRes.data ?? [],
  };
}
