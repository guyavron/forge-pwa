import type { ReactNode } from "react";

interface ProgressBarProps {
  label: string;
  consumed: number;
  target: number;
  unit?: string;
  colorClassName: string; // e.g. "bg-protein"
  badge?: ReactNode;
  showPercent?: boolean;
}

export function ProgressBar({ label, consumed, target, unit = "g", colorClassName, badge, showPercent = false }: ProgressBarProps) {
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const percentComplete = target > 0 ? Math.round((consumed / target) * 100) : 0;
  return (
    <div className="mb-3.5 last:mb-0">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-text-secondary">
          {label}
          {badge}
        </span>
        <span className="text-[13px] font-semibold text-text-primary">
          {Math.round(consumed)}
          {unit} <span className="font-normal text-text-muted">/ {Math.round(target)}{unit}</span>
          {showPercent && <span className="font-normal text-text-muted"> ({percentComplete}%)</span>}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-elevated">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${colorClassName}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
