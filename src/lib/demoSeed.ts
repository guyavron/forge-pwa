import { supabase } from "@/lib/supabaseClient";
import { calculateMacros } from "@/lib/macroCalculator";
import { estimateStageMinutes } from "@/lib/sleepStages";
import { dayKey } from "@/lib/dateHelpers";
import type { MealCategory } from "@/types/database";

/**
 * Fills a brand-new demo (anonymous) account with one week of FICTIONAL data, so a visitor
 * lands on a populated dashboard instead of an empty onboarding form.
 *
 * Every row is inserted through the normal client with the demo user's own id, so Row-Level
 * Security applies exactly as it does for a real user. The profile row is written LAST: the
 * app treats "profile exists" as "setup finished", so if anything fails midway the next load
 * simply tries again instead of showing a half-filled demo.
 */

type MealSeed = [MealCategory, string, number, number, number, number, string]; // category, name, kcal, P, C, F, time

const MENU: MealSeed[][] = [
  [["Breakfast", "Oatmeal with banana & peanut butter", 620, 22, 88, 20, "08:15"], ["Lunch", "Chicken rice bowl", 780, 55, 90, 18, "13:00"], ["Snack", "Protein shake", 280, 40, 12, 6, "16:30"], ["Dinner", "Salmon, potatoes & salad", 850, 48, 70, 38, "19:45"], ["Snack", "Greek yogurt with honey", 260, 20, 30, 6, "21:30"]],
  [["Breakfast", "Shakshuka with bread", 640, 30, 55, 30, "08:30"], ["Lunch", "Beef burger & sweet potato", 900, 50, 85, 38, "13:15"], ["Snack", "Protein shake", 280, 40, 12, 6, "16:30"], ["Dinner", "Pasta with turkey bolognese", 820, 52, 105, 20, "20:00"]],
  [["Breakfast", "Omelette (3 eggs) & toast", 560, 32, 40, 28, "08:00"], ["Lunch", "Chicken shawarma plate", 950, 60, 95, 35, "13:30"], ["Snack", "Cottage cheese & crackers", 310, 26, 28, 10, "17:00"], ["Dinner", "Tuna salad & rice", 700, 45, 80, 20, "20:15"]],
  [["Breakfast", "Oatmeal with banana & peanut butter", 620, 22, 88, 20, "08:15"], ["Lunch", "Schnitzel, rice & veggies", 920, 50, 100, 32, "13:00"], ["Snack", "Protein shake", 280, 40, 12, 6, "16:30"], ["Dinner", "Chicken wrap", 720, 46, 70, 26, "19:30"], ["Snack", "Dates & almonds", 300, 6, 40, 14, "22:00"]],
  [["Breakfast", "Greek yogurt with granola", 520, 28, 65, 15, "08:45"], ["Lunch", "Chicken rice bowl", 780, 55, 90, 18, "13:00"], ["Snack", "Protein shake", 280, 40, 12, 6, "16:30"], ["Dinner", "Steak, potatoes & salad", 980, 62, 70, 45, "20:00"]],
  [["Breakfast", "Shakshuka with bread", 640, 30, 55, 30, "09:00"], ["Lunch", "Sushi (12 pcs)", 700, 30, 110, 14, "14:00"], ["Snack", "Protein bar", 230, 20, 25, 7, "17:00"], ["Dinner", "Pizza (3 slices)", 900, 36, 105, 36, "20:30"]],
  // today: a partly logged day, so the dashboard shows progress rather than a finished day
  [["Breakfast", "Oatmeal with banana & peanut butter", 620, 22, 88, 20, "08:15"], ["Lunch", "Chicken rice bowl", 780, 55, 90, 18, "13:00"], ["Snack", "Protein shake", 280, 40, 12, 6, "16:30"]],
];

// Strength sessions show a clear progression, so the "Progress made!" check has history to
// compare against: log Bench Press above 65 kg in the demo to see it.
type WorkoutSeed = { dayOffset: number; type: string; minutes: number; kcal: number | null; hr: number | null; exercises?: [string, number, number, number][] };
const WORKOUTS: WorkoutSeed[] = [
  { dayOffset: -6, type: "Gym", minutes: 60, kcal: 380, hr: 128, exercises: [["Bench Press", 4, 8, 60], ["Squat", 4, 6, 80], ["Pull-ups", 3, 8, 0]] },
  { dayOffset: -5, type: "Bouldering", minutes: 90, kcal: 520, hr: 122 },
  { dayOffset: -4, type: "Gym", minutes: 65, kcal: 400, hr: 130, exercises: [["Bench Press", 4, 8, 62.5], ["Squat", 4, 6, 82.5], ["Overhead Press", 3, 8, 40]] },
  { dayOffset: -3, type: "Running", minutes: 30, kcal: 330, hr: 152 },
  { dayOffset: -2, type: "Gym", minutes: 60, kcal: 390, hr: 129, exercises: [["Bench Press", 4, 6, 65], ["Squat", 4, 6, 85], ["Pull-ups", 3, 10, 0]] },
];
// "Steps & daily movement" entries (calories from a watch, no duration)
const STEPS: [number, number][] = [[-6, 250], [-4, 300], [-2, 220], [-1, 350]];
const SLEEP_MINUTES = [452, 415, 488, 430, 470, 395, 445];
const FAVORITES = [
  { name: "Protein shake", calories: 280, protein: 40, carbs: 12, fat: 6 },
  { name: "Chicken rice bowl", calories: 780, protein: 55, carbs: 90, fat: 18 },
  { name: "Oatmeal with banana & peanut butter", calories: 620, protein: 22, carbs: 88, fat: 20 },
];

function at(dayOffset: number, time: string): Date {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`Demo data (${what}): ${error.message}`);
}

export async function seedDemoData(userId: string): Promise<void> {
  const meals = MENU.flatMap((day, i) =>
    day.map(([meal_category, food_name, calories, protein_g, carbs_g, fat_g, time]) => ({
      user_id: userId, meal_category, food_name, calories, protein_g, carbs_g, fat_g,
      consumed_at: at(i - 6, time).toISOString(),
    }))
  );

  const workouts = [
    ...WORKOUTS.map((w) => ({
      id: crypto.randomUUID(), user_id: userId, workout_type: w.type, duration_minutes: w.minutes,
      calories_burned: w.kcal, heart_rate_avg: w.hr, notes: null, workout_date: at(w.dayOffset, "18:00").toISOString(),
    })),
    ...STEPS.map(([dayOffset, kcal]) => ({
      id: crypto.randomUUID(), user_id: userId, workout_type: "Other", duration_minutes: 0,
      calories_burned: kcal, heart_rate_avg: null, notes: "Quick active burn entry", workout_date: at(dayOffset, "21:00").toISOString(),
    })),
  ];

  const exerciseLogs = WORKOUTS.flatMap((w, i) =>
    (w.exercises ?? []).map(([exercise_name, sets, reps, weight_kg]) => ({
      user_id: userId, workout_id: workouts[i].id, exercise_name, sets, reps, weight_kg: weight_kg || null, notes: null,
    }))
  );

  const sleepLogs = SLEEP_MINUTES.map((total, i) => {
    const s = estimateStageMinutes(total);
    return {
      user_id: userId, log_date: dayKey(at(i - 6, "12:00")), total_asleep_minutes: s.rem + s.core + s.deep,
      awake_minutes: s.awake, rem_minutes: s.rem, core_minutes: s.core, deep_minutes: s.deep, bedtime: null, wake_time: null,
    };
  });

  const { error: workoutsError } = await supabase.from("workouts").insert(workouts);
  check(workoutsError, "workouts");

  const results = await Promise.all([
    supabase.from("meals").insert(meals),
    supabase.from("exercise_logs").insert(exerciseLogs),
    supabase.from("sleep_logs").upsert(sleepLogs, { onConflict: "user_id,log_date" }),
    supabase.from("water_logs").insert([500, 250, 500].map((amount_ml) => ({ user_id: userId, amount_ml, log_date: dayKey() }))),
    supabase.from("favorite_meals").insert(FAVORITES.map((f) => ({ ...f, user_id: userId }))),
  ]);
  results.forEach((r, i) => check(r.error, ["meals", "exercises", "sleep", "water", "favorites"][i]));

  const targets = calculateMacros({ age: 26, gender: "male", heightCm: 178, weightKg: 76, activityLevel: "moderate", goal: "muscle_gain" });
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId, email: null, age: 26, gender: "male", height: 178, current_weight: 76, target_weight: 80,
    activity_level: "moderate", fitness_goal: "muscle_gain",
    daily_calorie_target: targets.calorieTarget, daily_protein_target: targets.proteinTarget,
  }, { onConflict: "id" });
  check(profileError, "profile");
}
