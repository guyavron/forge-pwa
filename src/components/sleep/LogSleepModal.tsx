import { useState } from "react";
import { saveSleepLog } from "@/lib/api";
import { dayKey } from "@/lib/dateHelpers";
import { SLEEP_STAGE_COLORS, SLEEP_STAGE_LABELS, SLEEP_STAGE_ORDER, estimateStageMinutes, minutesBetween } from "@/lib/sleepStages";
import type { SleepLogRow } from "@/types/database";

type EntryMode = "duration" | "times";

const inputClass =
  "min-h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-text-primary placeholder:text-text-muted";

export function LogSleepModal({
  existing,
  onClose,
  onSaved,
}: {
  existing: SleepLogRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<EntryMode>(existing?.bedtime && existing?.wake_time ? "times" : "duration");
  const [durationHours, setDurationHours] = useState(
    existing?.total_asleep_minutes != null ? String(Math.floor(existing.total_asleep_minutes / 60)) : ""
  );
  const [durationMinutes, setDurationMinutes] = useState(
    existing?.total_asleep_minutes != null ? String(existing.total_asleep_minutes % 60) : ""
  );
  const [bedtime, setBedtime] = useState(existing?.bedtime ?? "23:00");
  const [wakeTime, setWakeTime] = useState(existing?.wake_time ?? "07:00");

  // Editing an existing log shows its stage minutes pre-filled as "customized" so they stay
  // visible/editable; a fresh log defaults to the estimator until the user opts in.
  const [customizeStages, setCustomizeStages] = useState(existing != null);
  const [awakeMin, setAwakeMin] = useState(existing?.awake_minutes != null ? String(existing.awake_minutes) : "");
  const [remMin, setRemMin] = useState(existing?.rem_minutes != null ? String(existing.rem_minutes) : "");
  const [coreMin, setCoreMin] = useState(existing?.core_minutes != null ? String(existing.core_minutes) : "");
  const [deepMin, setDeepMin] = useState(existing?.deep_minutes != null ? String(existing.deep_minutes) : "");

  const [saving, setSaving] = useState(false);

  // Total time in bed — either entered directly, or derived from bedtime -> wake time.
  const totalMinutes =
    mode === "duration"
      ? (Number(durationHours) || 0) * 60 + (Number(durationMinutes) || 0)
      : minutesBetween(bedtime, wakeTime);

  const canSubmit = totalMinutes > 0;

  const handleSave = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      let stages: Record<"awake" | "rem" | "core" | "deep", number>;
      if (customizeStages) {
        stages = {
          awake: Number(awakeMin) || 0,
          rem: Number(remMin) || 0,
          core: Number(coreMin) || 0,
          deep: Number(deepMin) || 0,
        };
      } else {
        // Dynamic estimator fallback — healthy default ratios of total time in bed.
        stages = estimateStageMinutes(totalMinutes);
      }

      await saveSleepLog({
        log_date: existing?.log_date ?? dayKey(),
        total_asleep_minutes: stages.rem + stages.core + stages.deep,
        awake_minutes: stages.awake,
        rem_minutes: stages.rem,
        core_minutes: stages.core,
        deep_minutes: stages.deep,
        bedtime: mode === "times" ? bedtime : existing?.bedtime ?? null,
        wake_time: mode === "times" ? wakeTime : existing?.wake_time ?? null,
      });
      onSaved();
    } catch (err) {
      console.error("Couldn't save sleep log:", err);
      alert("Couldn't save that sleep log — check the console for details.");
    } finally {
      setSaving(false);
    }
  };

  const preview = customizeStages
    ? {
        awake: Number(awakeMin) || 0,
        rem: Number(remMin) || 0,
        core: Number(coreMin) || 0,
        deep: Number(deepMin) || 0,
      }
    : estimateStageMinutes(totalMinutes);

  return (
    <div className="fixed inset-0 z-[60] flex items-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-surface p-5 pb-8 [-webkit-overflow-scrolling:touch]"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-4 text-lg font-extrabold text-text-primary">Log Sleep</h2>

        <div className="mb-4 flex rounded-xl border border-border bg-surface-elevated p-1">
          <button
            type="button"
            onClick={() => setMode("duration")}
            className={`min-h-9 flex-1 rounded-lg text-[12.5px] font-bold ${mode === "duration" ? "bg-accent text-background" : "text-text-secondary"}`}
          >
            Total Duration
          </button>
          <button
            type="button"
            onClick={() => setMode("times")}
            className={`min-h-9 flex-1 rounded-lg text-[12.5px] font-bold ${mode === "times" ? "bg-accent text-background" : "text-text-secondary"}`}
          >
            Bedtime & Wake
          </button>
        </div>

        {mode === "duration" ? (
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-text-secondary">Hours</label>
              <input type="number" inputMode="numeric" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} placeholder="8" className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-text-secondary">Minutes</label>
              <input type="number" inputMode="numeric" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="5" className={inputClass} />
            </div>
          </div>
        ) : (
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-text-secondary">Bedtime</label>
              <input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-text-secondary">Wake Time</label>
              <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className={inputClass} />
            </div>
          </div>
        )}

        <label className="mb-3 flex min-h-9 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={customizeStages}
            onChange={(e) => setCustomizeStages(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span className="text-[13px] font-semibold text-text-secondary">Customize sleep stages</span>
        </label>

        {customizeStages ? (
          <div className="mb-4 grid grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-text-secondary">Awake (min)</label>
              <input type="number" inputMode="numeric" value={awakeMin} onChange={(e) => setAwakeMin(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-text-secondary">REM (min)</label>
              <input type="number" inputMode="numeric" value={remMin} onChange={(e) => setRemMin(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-text-secondary">Core (min)</label>
              <input type="number" inputMode="numeric" value={coreMin} onChange={(e) => setCoreMin(e.target.value)} placeholder="0" className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-text-secondary">Deep (min)</label>
              <input type="number" inputMode="numeric" value={deepMin} onChange={(e) => setDeepMin(e.target.value)} placeholder="0" className={inputClass} />
            </div>
          </div>
        ) : (
          totalMinutes > 0 && (
            <div className="mb-4 rounded-xl border border-border bg-surface-elevated p-3">
              <p className="mb-2 text-[11px] font-semibold text-text-muted">
                Estimated breakdown (60% Core / 20% REM / 15% Deep / 5% Awake) — edit above to override
              </p>
              <div className="flex gap-3 text-[11.5px] font-bold text-text-primary">
                {SLEEP_STAGE_ORDER.map((s) => (
                  <span key={s} className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SLEEP_STAGE_COLORS[s] }} />
                    {SLEEP_STAGE_LABELS[s]} {preview[s]}m
                  </span>
                ))}
              </div>
            </div>
          )
        )}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-xl border border-border text-[15px] font-bold text-text-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSubmit || saving}
            className="min-h-12 flex-1 rounded-xl bg-accent text-[15px] font-extrabold text-background disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
