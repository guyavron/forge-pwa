/**
 * Hand-written types mirroring the Supabase schema (see the SQL DDL you ran). Row shapes use
 * the DB's own snake_case column names directly rather than mapping to camelCase — this app
 * is small enough that an extra mapping layer wasn't worth the indirection. If this grows,
 * regenerate proper types instead with `npx supabase gen types typescript`.
 */

export interface ProfileRow {
  id: string;
  age: number | null;
  height: number | null;
  current_weight: number | null;
  target_weight: number | null;
  fitness_goal: string | null;
  daily_calorie_target: number | null;
  daily_protein_target: number | null;
  created_at: string;
}

export type WorkoutType = "Gym" | "Bouldering" | "Running" | "Cardio" | "Cycling" | "Swimming" | "Other";

export interface WorkoutRow {
  id: string;
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
  sleep_hours: number | null;
  quality_rating: number | null;
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
    };
  };
}
