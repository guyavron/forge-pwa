import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, Loader2, Star, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { UndoToast } from "@/components/ui/UndoToast";
import { addFavoriteMeal, addMeal, deleteMeal, getFavoriteMeals, getMealsForDate, restoreMeal } from "@/lib/api";
import { dayKey } from "@/lib/dateHelpers";
import { fileToBase64, scanMealImage } from "@/services/GeminiVisionService";
import type { FavoriteMealRow, MealCategory, MealRow, ProfileRow } from "@/types/database";

const MEAL_CATEGORIES: MealCategory[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

// favorite_meals has no meal_category column (it's category-agnostic by design) — one-tap
// adds from the favorites bar ask which category via CategoryPickerSheet below.
const CATEGORY_EMOJI: Record<MealCategory, string> = {
  Breakfast: "🍳",
  Lunch: "🥗",
  Dinner: "🍽️",
  Snack: "🥨",
};

export function Nutrition({ profile }: { profile: ProfileRow }) {
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [favorites, setFavorites] = useState<FavoriteMealRow[]>([]);
  const [activeCategory, setActiveCategory] = useState<MealCategory | null>(null);
  const [pendingFavorite, setPendingFavorite] = useState<FavoriteMealRow | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanDraft, setScanDraft] = useState<ScanDraft | null>(null);
  const [undoMeal, setUndoMeal] = useState<MealRow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadMeals = () => {
    getMealsForDate(dayKey()).then(setMeals).catch(console.error);
  };
  const loadFavorites = () => {
    getFavoriteMeals().then(setFavorites).catch(console.error);
  };

  useEffect(() => {
    loadMeals();
    loadFavorites();
  }, []);

  const handleDelete = async (meal: MealRow) => {
    try {
      await deleteMeal(meal.id);
      loadMeals();
      setUndoMeal(meal);
    } catch (err) {
      console.error(err);
      alert("Couldn't delete that entry.");
    }
  };

  const handleUndoDelete = async () => {
    const meal = undoMeal;
    if (!meal) return;
    setUndoMeal(null);
    try {
      await restoreMeal(meal);
      loadMeals();
    } catch (err) {
      console.error("Couldn't restore that entry:", err);
      alert("Couldn't restore that entry.");
    }
  };

  const handleFavorite = async (meal: MealRow) => {
    try {
      await addFavoriteMeal({
        name: meal.food_name,
        calories: meal.calories ?? 0,
        protein: meal.protein_g,
        carbs: meal.carbs_g,
        fat: meal.fat_g,
      });
      loadFavorites();
    } catch (err) {
      console.error("Couldn't save as favorite:", err);
      alert("Couldn't save as favorite — check the console for details.");
    }
  };

  const handleConfirmFavoriteCategory = async (category: MealCategory) => {
    const fav = pendingFavorite;
    if (!fav) return;
    setPendingFavorite(null);
    try {
      await addMeal({
        meal_category: category,
        food_name: fav.name,
        calories: fav.calories,
        protein_g: fav.protein ?? 0,
        carbs_g: fav.carbs ?? 0,
        fat_g: fav.fat ?? 0,
      });
      loadMeals();
    } catch (err) {
      console.error("Couldn't add that favorite:", err);
      alert("Couldn't add that favorite.");
    }
  };

  const handlePickPhoto = () => fileInputRef.current?.click();

  const handlePhotoSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;
    setScanning(true);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const result = await scanMealImage(base64, mimeType);
      setScanDraft({
        category: "Snack",
        name: result.meal_name,
        calories: result.calories != null ? String(result.calories) : "",
        protein: result.protein != null ? String(result.protein) : "",
        carbs: result.carbs != null ? String(result.carbs) : "",
        fat: result.fat != null ? String(result.fat) : "",
      });
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Couldn't scan that photo.");
    } finally {
      setScanning(false);
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

      <div className="mb-4">
        <h3 className="mb-2.5 text-[13px] font-bold text-text-secondary">Quick Add Favorites</h3>
        {favorites.length === 0 ? (
          <Card>
            <p className="text-center text-[12.5px] text-text-secondary">
              ⭐ No favorites saved yet. Tap the star on any logged meal or check "Save to
              Favorites" when adding a meal to quick-log it here.
            </p>
          </Card>
        ) : (
          <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
            {favorites.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setPendingFavorite(f)}
                className="flex min-h-14 flex-none items-center gap-2 rounded-2xl border border-accent/40 bg-accent-muted px-3.5 text-left"
              >
                <Star size={14} className="flex-none fill-accent text-accent" />
                <div className="min-w-0">
                  <p className="max-w-[9.5rem] truncate text-[12.5px] font-bold text-text-primary">{f.name}</p>
                  <p className="text-[10.5px] text-text-secondary">
                    {Math.round(f.calories)} kcal / {Math.round(f.protein ?? 0)}g P
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <Card className="mb-4">
        <ProgressBar label="Calories" consumed={totals.calories} target={profile.daily_calorie_target ?? 0} unit=" kcal" colorClassName="bg-accent" showPercent />
        <ProgressBar label="Protein" consumed={totals.protein_g} target={profile.daily_protein_target ?? 0} colorClassName="bg-protein" showPercent />
        <ProgressBar label="Carbs" consumed={totals.carbs_g} target={Math.max(profile.daily_calorie_target ?? 0, 0) / 4} colorClassName="bg-carbs" />
        <ProgressBar label="Fat" consumed={totals.fat_g} target={Math.max(profile.daily_calorie_target ?? 0, 0) * 0.25 / 9} colorClassName="bg-fat" />
      </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelected}
      />
      <button
        type="button"
        onClick={handlePickPhoto}
        disabled={scanning}
        className="mb-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-accent/50 bg-accent-muted text-[14px] font-extrabold text-accent disabled:opacity-60"
      >
        {scanning ? (
          <>
            <Loader2 size={17} className="animate-spin" /> Analyzing photo…
          </>
        ) : (
          <>
            <Camera size={17} /> Scan Meal with AI
          </>
        )}
      </button>

      {MEAL_CATEGORIES.map((category) => {
        const entries = meals.filter((m) => m.meal_category === category);
        const kcal = entries.reduce((sum, m) => sum + (m.calories ?? 0), 0);
        return (
          <Card key={category} className="mb-3">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-text-primary">
                {CATEGORY_EMOJI[category]} {category}
              </h3>
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
                  <button type="button" onClick={() => handleFavorite(m)} className="flex h-11 w-9 flex-none items-center justify-center text-text-muted">
                    <Star size={15} />
                  </button>
                  <button type="button" onClick={() => handleDelete(m)} className="flex h-11 w-9 flex-none items-center justify-center text-danger">
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
          onAdded={() => {
            loadMeals();
            loadFavorites();
          }}
        />
      )}

      {scanDraft && (
        <ScanReviewSheet
          draft={scanDraft}
          onClose={() => setScanDraft(null)}
          onSaved={() => {
            setScanDraft(null);
            loadMeals();
          }}
        />
      )}

      {pendingFavorite && (
        <CategoryPickerSheet
          favoriteName={pendingFavorite.name}
          onClose={() => setPendingFavorite(null)}
          onPick={handleConfirmFavoriteCategory}
        />
      )}

      {undoMeal && (
        <UndoToast
          message="Item deleted."
          onUndo={handleUndoDelete}
          onExpire={() => setUndoMeal(null)}
        />
      )}
    </div>
  );
}

function CategoryPickerSheet({
  favoriteName,
  onClose,
  onPick,
}: {
  favoriteName: string;
  onClose: () => void;
  onPick: (category: MealCategory) => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-surface p-5 pb-8 [-webkit-overflow-scrolling:touch]"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-1 text-lg font-extrabold text-text-primary">Log "{favoriteName}"</h2>
        <p className="mb-4 text-xs text-text-secondary">Which meal is this for?</p>

        <div className="grid grid-cols-2 gap-3">
          {MEAL_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onPick(c)}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-surface-elevated"
            >
              <span className="text-2xl">{CATEGORY_EMOJI[c]}</span>
              <span className="text-[13px] font-bold text-text-primary">{c}</span>
            </button>
          ))}
        </div>

        <button type="button" onClick={onClose} className="mt-4 min-h-11 w-full rounded-xl border border-border text-[14px] font-bold text-text-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}

interface ScanDraft {
  category: MealCategory;
  name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
}

function ScanReviewSheet({
  draft,
  onClose,
  onSaved,
}: {
  draft: ScanDraft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState(draft.category);
  const [name, setName] = useState(draft.name);
  const [calories, setCalories] = useState(draft.calories);
  const [protein, setProtein] = useState(draft.protein);
  const [carbs, setCarbs] = useState(draft.carbs);
  const [fat, setFat] = useState(draft.fat);
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim() && Number(calories) > 0;

  const handleSave = async () => {
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
      onSaved();
    } catch (err) {
      console.error(err);
      alert("Couldn't save that entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-surface p-5 pb-8 [-webkit-overflow-scrolling:touch]"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-1 text-lg font-extrabold text-text-primary">Review AI Scan</h2>
        <p className="mb-3.5 text-xs text-text-secondary">Check the estimate and edit anything before saving.</p>

        <div className="mb-3.5 flex flex-wrap gap-2">
          {MEAL_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`min-h-8 rounded-lg border px-2.5 text-[12px] font-semibold ${
                category === c ? "border-accent bg-accent-muted text-accent" : "border-border bg-surface-elevated text-text-secondary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

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
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit || saving}
            className="min-h-12 flex-1 rounded-xl bg-accent text-[15px] font-extrabold text-background disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save to Log"}
          </button>
        </div>
      </div>
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
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const resetFields = () => {
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setSaveAsFavorite(false);
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
      if (saveAsFavorite) {
        // A favorite-save failure shouldn't undo or block the meal log that already succeeded.
        try {
          await addFavoriteMeal({
            name: name.trim(),
            calories: Number(calories),
            protein: Number(protein) || 0,
            carbs: Number(carbs) || 0,
            fat: Number(fat) || 0,
          });
        } catch (favErr) {
          console.error("Couldn't save as favorite:", favErr);
        }
      }
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
    <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-surface p-5 pb-8 [-webkit-overflow-scrolling:touch]"
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

        <label className="mb-4 flex min-h-9 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={saveAsFavorite}
            onChange={(e) => setSaveAsFavorite(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span className="text-[13px] font-semibold text-text-secondary">
            ⭐ Save to Favorites for 1-tap quick logging
          </span>
        </label>

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
