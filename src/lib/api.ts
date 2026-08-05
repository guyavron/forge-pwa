import { supabase } from "@/lib/supabaseClient";
import { dayBounds } from "@/lib/dateHelpers";
import type { ExerciseLogRow, MealRow, ProfileRow, SleepLogRow, WorkoutRow } from "@/types/database";

/**
 * Thin data-access layer over Supabase — components call these instead of using the raw
 * client directly, so query shape/error handling lives in one place. Single-user/no-auth
 * (matching the DB schema): there is exactly one profiles row, found by `getProfile`.
 */

// ---------- Profile ----------

export async function getProfile(): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from("profiles").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProfile(
  existingId: string | null,
  fields: Omit<ProfileRow, "id" | "created_at">
): Promise<ProfileRow> {
  if (existingId) {
    const { data, error } = await supabase.from("profiles").update(fields).eq("id", existingId).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from("profiles").insert(fields).select().single();
  if (error) throw error;
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
  const { start, end } = dayBounds(day);
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .gte("workout_date", start)
    .lt("workout_date", end)
    .order("workout_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getRecentWorkouts(limit = 10): Promise<WorkoutRow[]> {
  const { data, error } = await supabase
    .from("workouts")
    .select("*")
    .order("workout_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getExerciseLogsForWorkout(workoutId: string): Promise<ExerciseLogRow[]> {
  const { data, error } = await supabase
    .from("exercise_logs")
    .select("*")
    .eq("workout_id", workoutId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Creates the workout row, then its exercise_logs rows (if any). Returns the new workout. */
export async function createWorkout(input: NewWorkoutInput): Promise<WorkoutRow> {
  const { data: workout, error: workoutError } = await supabase
    .from("workouts")
    .insert({
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
      .insert(namedExercises.map((e) => ({ ...e, workout_id: workout.id })));
    if (exerciseError) throw exerciseError;
  }

  return workout;
}

export async function deleteWorkout(id: string): Promise<void> {
  // exercise_logs cascade-deletes via the FK's `on delete cascade`.
  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) throw error;
}

/** Best weight/reps logged for this exercise name in the most recent workout strictly before
 *  `beforeDate` — used to compute the progressive-overload comparison after saving a session. */
export async function getPreviousBestForExercise(
  exerciseName: string,
  beforeDate: string
): Promise<{ weight_kg: number | null; reps: number | null }[] | null> {
  const { data: priorWorkout, error: workoutError } = await supabase
    .from("workouts")
    .select("id, workout_date")
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
  const { start, end } = dayBounds(day);
  const { data, error } = await supabase
    .from("meals")
    .select("*")
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
  const { data, error } = await supabase.from("meals").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Sleep ----------

export async function getLatestSleepLog(): Promise<SleepLogRow | null> {
  const { data, error } = await supabase
    .from("sleep_logs")
    .select("*")
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
