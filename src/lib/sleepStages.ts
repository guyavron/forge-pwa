/** Apple Health's native sleep-stage color theme — fixed brand colors, not part of Forge's own
 *  semantic palette, so used directly as hex rather than added to the theme's CSS vars. */
export const SLEEP_STAGE_COLORS = {
  awake: "#FF453A",
  rem: "#64D2FF",
  core: "#0A84FF",
  deep: "#5E5CE6",
} as const;

export type SleepStage = keyof typeof SLEEP_STAGE_COLORS;

export const SLEEP_STAGE_ORDER: SleepStage[] = ["awake", "rem", "core", "deep"];

export const SLEEP_STAGE_LABELS: Record<SleepStage, string> = {
  awake: "Awake",
  rem: "REM",
  core: "Core",
  deep: "Deep",
};

/** Healthy default split of total time in bed, applied when the user logs only a total
 *  duration without customizing individual stages. Sums to 100%. */
const ESTIMATE_RATIOS: Record<SleepStage, number> = {
  core: 0.6,
  rem: 0.2,
  deep: 0.15,
  awake: 0.05,
};

export function estimateStageMinutes(totalMinutes: number): Record<SleepStage, number> {
  return {
    core: Math.round(totalMinutes * ESTIMATE_RATIOS.core),
    rem: Math.round(totalMinutes * ESTIMATE_RATIOS.rem),
    deep: Math.round(totalMinutes * ESTIMATE_RATIOS.deep),
    awake: Math.round(totalMinutes * ESTIMATE_RATIOS.awake),
  };
}

export function formatHrMin(totalMinutes: number): { hours: number; minutes: number } {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
}

export function formatHrMinLabel(totalMinutes: number): string {
  const { hours, minutes } = formatHrMin(totalMinutes);
  if (hours === 0) return `${minutes} min`;
  return `${hours} hr ${minutes} min`;
}

/** Minutes between two "HH:MM" times, assuming the second wraps past midnight if it's earlier
 *  in the day than the first (bedtime 23:00 -> wake 07:05 spans midnight). */
export function minutesBetween(startHHMM: string, endHHMM: string): number {
  const [sh, sm] = startHHMM.split(":").map(Number);
  const [eh, em] = endHHMM.split(":").map(Number);
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return endMin - startMin;
}
