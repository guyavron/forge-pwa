import type { ExerciseLogRow, MealRow, WorkoutRow } from "@/types/database";

function toCsvRow(fields: (string | number | null)[]): string {
  return fields
    .map((f) => {
      const s = f == null ? "" : String(f);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(",");
}

function buildMealsCsv(meals: MealRow[]): string {
  const header = toCsvRow(["consumed_at", "meal_category", "food_name", "calories", "protein_g", "carbs_g", "fat_g"]);
  const rows = meals.map((m) =>
    toCsvRow([m.consumed_at, m.meal_category, m.food_name, m.calories, m.protein_g, m.carbs_g, m.fat_g])
  );
  return [header, ...rows].join("\n");
}

function buildWorkoutsCsv(workouts: WorkoutRow[], exerciseLogs: ExerciseLogRow[]): string {
  const header = toCsvRow([
    "workout_date",
    "workout_type",
    "duration_minutes",
    "calories_burned",
    "heart_rate_avg",
    "notes",
    "exercise_name",
    "sets",
    "reps",
    "weight_kg",
  ]);
  const rows: string[] = [];
  for (const w of workouts) {
    const exercises = exerciseLogs.filter((e) => e.workout_id === w.id);
    if (exercises.length === 0) {
      rows.push(
        toCsvRow([w.workout_date, w.workout_type, w.duration_minutes, w.calories_burned, w.heart_rate_avg, w.notes, "", "", "", ""])
      );
    } else {
      for (const e of exercises) {
        rows.push(
          toCsvRow([
            w.workout_date,
            w.workout_type,
            w.duration_minutes,
            w.calories_burned,
            w.heart_rate_avg,
            w.notes,
            e.exercise_name,
            e.sets,
            e.reps,
            e.weight_kg,
          ])
        );
      }
    }
  }
  return [header, ...rows].join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Exports meals and workouts (with their exercise sets folded in) as two separate CSV
 *  downloads — kept as two files rather than one combined sheet since the columns don't share
 *  a common shape. */
export function exportDataToCsv(meals: MealRow[], workouts: WorkoutRow[], exerciseLogs: ExerciseLogRow[]) {
  const today = new Date().toISOString().slice(0, 10);
  downloadCsv(`forge-meals-${today}.csv`, buildMealsCsv(meals));
  downloadCsv(`forge-workouts-${today}.csv`, buildWorkoutsCsv(workouts, exerciseLogs));
}
