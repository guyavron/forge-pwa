import type { ActivityLevel, FitnessGoal, Gender } from "@/types/database";

export const ACTIVITY_LEVELS: { value: ActivityLevel; label: string; description: string; multiplier: number }[] = [
  { value: "sedentary", label: "Sedentary", description: "Desk job, little to no exercise", multiplier: 1.2 },
  { value: "light", label: "Lightly Active", description: "1-2 workouts per week", multiplier: 1.375 },
  { value: "moderate", label: "Moderately Active", description: "3-5 workouts per week", multiplier: 1.55 },
  { value: "very_active", label: "Very Active", description: "6-7 intense workouts per week", multiplier: 1.725 },
];

export const FITNESS_GOALS: { value: FitnessGoal; label: string }[] = [
  { value: "muscle_gain", label: "Muscle Gain / Lean Bulk" },
  { value: "fat_loss", label: "Fat Loss / Cut" },
  { value: "maintenance", label: "Maintenance" },
];

const GOAL_CALORIE_ADJUSTMENT: Record<FitnessGoal, number> = {
  muscle_gain: 350,
  fat_loss: -450,
  maintenance: 0,
};

/** g of protein per kg of current body weight — 2.2 sits at the top of the 2.0-2.2 range
 *  the spec calls for, which favors muscle retention in both a surplus and a deficit. */
const PROTEIN_G_PER_KG = 2.2;

export interface MacroInputs {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
}

export interface MacroRecommendation {
  bmr: number;
  tdee: number;
  calorieTarget: number;
  proteinTarget: number;
}

/** Mifflin-St Jeor BMR, adjusted by activity multiplier and goal, per the app's nutrition spec. */
export function calculateMacros(inputs: MacroInputs): MacroRecommendation {
  const { age, gender, heightCm, weightKg, activityLevel, goal } = inputs;

  const bmr =
    gender === "male"
      ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
      : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

  const multiplier = ACTIVITY_LEVELS.find((a) => a.value === activityLevel)?.multiplier ?? 1.2;
  const tdee = bmr * multiplier;
  const calorieTarget = tdee + GOAL_CALORIE_ADJUSTMENT[goal];
  const proteinTarget = weightKg * PROTEIN_G_PER_KG;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorieTarget: Math.round(calorieTarget),
    proteinTarget: Math.round(proteinTarget),
  };
}

/** Share of daily calories that comes from fat. */
const FAT_CALORIE_SHARE = 0.25;

/** Carb and fat gram targets that fit inside the calorie target together with protein.
 *  Protein and carbs are 4 kcal/g, fat is 9 kcal/g; fat takes a fixed 25% of calories and
 *  carbs get whatever is left, so protein + carbs + fat add up to the calorie target. */
export function macroGramTargets(calorieTarget: number, proteinTarget: number): { carbs: number; fat: number } {
  const calories = Math.max(calorieTarget, 0);
  const fat = (calories * FAT_CALORIE_SHARE) / 9;
  const carbs = Math.max(calories - Math.max(proteinTarget, 0) * 4 - fat * 9, 0) / 4;
  return { carbs, fat };
}
