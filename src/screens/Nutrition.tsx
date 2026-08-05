import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { addMeal, deleteMeal, getMealsForDate } from "@/lib/api";
import { dayKey } from "@/lib/dateHelpers";
import type { MealCategory, MealRow, ProfileRow } from "@/types/database";

const MEAL_CATEGORIES: MealCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export function Nutrition({ profile }: { profile: ProfileRow }) {
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [activeCategory, setActiveCategory] = useState<MealCategory | null>(null);

  const loadMeals = () => {
    getMealsForDate(dayKey()).then(setMeals).catch(console.error);
  };

  useEffect(loadMeals, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this food entry?")) return;
    try {
      await deleteMeal(id);
      loadMeals();
    } catch (err) {
      console.error(err);
      alert("Couldn't delete that entry.");
    }
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

  return (
    <div className="px-4 pt-3">
      <h1 className="mb-4 text-2xl font-extrabold text-text-primary">Nutrition</h1>

      <Card className="mb-4">
        <ProgressBar label="Calories" consumed={totals.calories} target={profile.daily_calorie_target ?? 0} unit=" kcal" colorClassName="bg-accent" />
        <ProgressBar label="Protein" consumed={totals.protein_g} target={profile.daily_protein_target ?? 0} colorClassName="bg-protein" />
        <ProgressBar label="Carbs" consumed={totals.carbs_g} target={Math.max(profile.daily_calorie_target ?? 0, 0) / 4} colorClassName="bg-carbs" />
        <ProgressBar label="Fat" consumed={totals.fat_g} target={Math.max(profile.daily_calorie_target ?? 0, 0) * 0.25 / 9} colorClassName="bg-fat" />
      </Card>

      {MEAL_CATEGORIES.map((category) => {
        const entries = meals.filter((m) => m.meal_category === category);
        const kcal = entries.reduce((sum, m) => sum + (m.calories ?? 0), 0);
        return (
          <Card key={category} className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-text-primary">{category}</h3>
              <div className="flex items-center gap-3">
                <span className="text-[13px] text-text-secondary">{Math.round(kcal)} kcal</span>
                <button
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className="min-h-8 rounded-lg bg-accent-muted px-2.5 text-xs font-bold text-accent"
                >
                  + Add
                </button>
              </div>
            </div>
            {entries.length === 0 ? (
              <p className="py-2 text-xs text-text-muted">Nothing logged yet</p>
            ) : (
              entries.map((m) => (
                <div key={m.id} className="flex min-h-11 items-center justify-between border-t border-border py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text-primary">{m.food_name}</p>
                    <p className="text-xs text-text-muted">
                      {Math.round(m.calories ?? 0)} kcal · P{Math.round(m.protein_g ?? 0)} C{Math.round(m.carbs_g ?? 0)} F{Math.round(m.fat_g ?? 0)}
                    </p>
                  </div>
                  <button type="button" onClick={() => handleDelete(m.id)} className="flex h-11 w-11 flex-none items-center justify-center text-danger">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))
            )}
          </Card>
        );
      })}

      {activeCategory && (
        <QuickAddSheet
          category={activeCategory}
          onClose={() => setActiveCategory(null)}
          onAdded={loadMeals}
        />
      )}
    </div>
  );
}

function QuickAddSheet({
  category,
  onClose,
  onAdded,
}: {
  category: MealCategory;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [addedCount, setAddedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const resetFields = () => {
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
  };

  const canSubmit = name.trim() && Number(calories) > 0;

  const handleAdd = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await addMeal({
        meal_category: category,
        food_name: name.trim(),
        calories: Number(calories),
        protein_g: Number(protein) || 0,
        carbs_g: Number(carbs) || 0,
        fat_g: Number(fat) || 0,
      });
      onAdded();
      setAddedCount((n) => n + 1);
      resetFields(); // stays open — add several items to this meal in one go
    } catch (err) {
      console.error(err);
      alert("Couldn't save that entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl border-t border-border bg-surface p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-1 text-lg font-extrabold text-text-primary">Add to {category}</h2>
        {addedCount > 0 && <p className="mb-3 text-xs font-semibold text-success">{addedCount} item{addedCount > 1 ? "s" : ""} added so far</p>}

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Food name"
          className="mb-2.5 min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted"
        />
        <div className="mb-2.5 grid grid-cols-2 gap-2.5">
          <input type="number" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="Calories" className="min-h-11 rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted" />
          <input type="number" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="Protein (g)" className="min-h-11 rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted" />
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          <input type="number" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="Carbs (g)" className="min-h-11 rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted" />
          <input type="number" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} placeholder="Fat (g)" className="min-h-11 rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted" />
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-border text-[15px] font-bold text-text-secondary">
            Done
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!canSubmit || saving}
            className="min-h-12 flex-1 rounded-xl bg-accent text-[15px] font-extrabold text-background disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
