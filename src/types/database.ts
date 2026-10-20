/**
 * Hand-written types mirroring the Supabase schema (see the SQL DDL you ran). Row shapes use
 * the DB's own snake_case column names directly rather than mapping to camelCase — this app
 * is small enough that an extra mapping layer wasn't worth the indirection. If this grows,
 * regenerate proper types instead with `npx supabase gen types typescript`.
 */

export type Gender = "male" | "female";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "very_active";

export type FitnessGoal = "muscle_gain" | "fat_loss" | "maintenance";

export interface ProfileRow {
  // `id` IS the auth user id on this table (no separate `user_id` FK, no default —
  // callers must always supply it explicitly). RLS checks `auth.uid() = id` directly.
  id: string;
  email: string | null;
  age: number | null;
  gender: Gender | null;
  height: number | null;
  current_weight: number | null;
  target_weight: number | null;
  activity_level: ActivityLevel | null;
  fitness_goal: FitnessGoal | null;
  daily_calorie_target: number | null;
  daily_protein_target: number | null;
  created_at: string;
  updated_at: string;
}

export type WorkoutType = "Gym" | "Bouldering" | "Running" | "Cardio" | "Cycling" | "Swimming" | "Other";

export interface WorkoutRow {
  id: string;
  user_id: string;
  workout_type: string;
  duration_minutes: number | null;
  calories_burned: number | null;
  heart_rate_avg: number | null;
  notes: string | null;
  workout_date: string;
  created_at: string;
}

export interface ExerciseLogRow {
  id: string;
  user_id: string;
  workout_id: string;
  exercise_name: string;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  notes: string | null;
  created_at: string;
}

export type MealCategory = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export interface MealRow {
  id: string;
  user_id: string;
  meal_category: MealCategory;
  food_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  consumed_at: string;
  created_at: string;
}

export interface SleepLogRow {
  id: string;
  user_id: string;
  // `log_date` is what the Apple Health-style spec calls "date" (YYYY-MM-DD) — kept as the
  // existing DB column name rather than renamed, per this file's DB-names-flow-through rule.
  log_date: string;
  total_asleep_minutes: number | null;
  awake_minutes: number | null;
  rem_minutes: number | null;
  core_minutes: number | null;
  deep_minutes: number | null;
  bedtime: string | null; // "HH:MM"
  wake_time: string | null; // "HH:MM"
  // Legacy columns from the original simple sleep tracker — unused by the Apple Health-style
  // dashboard but left in place rather than dropped, since existing rows may still have them.
  sleep_hours: number | null;
  quality_rating: number | null;
  created_at: string;
}

export interface FavoriteMealRow {
  // Category-agnostic by design on this table — no `meal_category` column. Column names also
  // don't carry the `_g` suffix meals.* uses (`name`/`calories`/`protein`/`carbs`/`fat`).
  id: string;
  user_id: string;
  name: string;
  calories: number;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  created_at: string;
}

export interface WaterLogRow {
  id: string;
  user_id: string;
  amount_ml: number;
  log_date: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: ProfileRow; Insert: Partial<ProfileRow>; Update: Partial<ProfileRow> };
      workouts: { Row: WorkoutRow; Insert: Partial<WorkoutRow>; Update: Partial<WorkoutRow> };
      exercise_logs: { Row: ExerciseLogRow; Insert: Partial<ExerciseLogRow>; Update: Partial<ExerciseLogRow> };
      meals: { Row: MealRow; Insert: Partial<MealRow>; Update: Partial<MealRow> };
      sleep_logs: { Row: SleepLogRow; Insert: Partial<SleepLogRow>; Update: Partial<SleepLogRow> };
      favorite_meals: { Row: FavoriteMealRow; Insert: Partial<FavoriteMealRow>; Update: Partial<FavoriteMealRow> };
      water_logs: { Row: WaterLogRow; Insert: Partial<WaterLogRow>; Update: Partial<WaterLogRow> };
    };
  };
}
