import { Pencil, X } from "lucide-react";
import {
  SLEEP_STAGE_COLORS,
  SLEEP_STAGE_LABELS,
  SLEEP_STAGE_ORDER,
  formatHrMin,
  formatHrMinLabel,
} from "@/lib/sleepStages";
import type { SleepLogRow } from "@/types/database";

function formatLogDate(logDate: string): string {
  return new Date(`${logDate}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function SleepDetailModal({
  log,
  onClose,
  onEdit,
}: {
  log: SleepLogRow;
  onClose: () => void;
  onEdit: () => void;
}) {
  const stageMinutes: Record<string, number> = {
    awake: log.awake_minutes ?? 0,
    rem: log.rem_minutes ?? 0,
    core: log.core_minutes ?? 0,
    deep: log.deep_minutes ?? 0,
  };
  const stageTotal = SLEEP_STAGE_ORDER.reduce((sum, s) => sum + stageMinutes[s], 0);
  const timeAsleep = log.total_asleep_minutes ?? stageMinutes.rem + stageMinutes.core + stageMinutes.deep;
  const { hours, minutes } = formatHrMin(timeAsleep);

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-lg flex-col bg-background">
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated text-text-secondary">
          <X size={17} />
        </button>
        <h1 className="text-[15px] font-extrabold text-text-primary">Sleep</h1>
        <button type="button" onClick={onEdit} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated text-accent">
          <Pencil size={15} />
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto px-5 [-webkit-overflow-scrolling:touch]"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2.5rem)" }}
      >
        <p className="mb-1 text-[11px] font-extrabold tracking-widest text-text-muted">TIME ASLEEP</p>
        <p className="mb-1 text-[34px] font-extrabold leading-tight text-text-primary">
          {hours}
          <span className="text-[17px] font-bold text-text-secondary"> hr </span>
          {minutes}
          <span className="text-[17px] font-bold text-text-secondary"> min</span>
        </p>
        <p className="mb-6 text-[13px] text-text-secondary">{formatLogDate(log.log_date)}</p>

        {stageTotal > 0 && (
          <div className="mb-2">
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {SLEEP_STAGE_ORDER.map((stage) =>
                stageMinutes[stage] > 0 ? (
                  <div
                    key={stage}
                    style={{
                      width: `${(stageMinutes[stage] / stageTotal) * 100}%`,
                      backgroundColor: SLEEP_STAGE_COLORS[stage],
                    }}
                  />
                ) : null
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-semibold text-text-muted">
              <span>{log.bedtime ?? "—"}</span>
              <span>{log.wake_time ?? "—"}</span>
            </div>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {SLEEP_STAGE_ORDER.map((stage) => (
            <div key={stage} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SLEEP_STAGE_COLORS[stage] }} />
                <span className="text-[14px] font-semibold text-text-primary">{SLEEP_STAGE_LABELS[stage]}</span>
              </div>
              <span className="text-[14px] font-bold text-text-primary">{formatHrMinLabel(stageMinutes[stage])}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
