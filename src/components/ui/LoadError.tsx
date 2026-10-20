import { RefreshCw } from "lucide-react";

/** Shown instead of an empty state when a load fails. An empty list ("Nothing logged yet")
 *  after a network error looks exactly like lost data, so failures must be visible. */
export function LoadError({ onRetry, message = "Couldn't load your data. Check your connection." }: { onRetry: () => void; message?: string }) {
  return (
    <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-danger/40 bg-surface p-4">
      <p className="text-[13px] font-semibold text-danger">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="flex min-h-10 flex-none items-center gap-1.5 rounded-xl border border-border px-3 text-[13px] font-bold text-text-primary"
      >
        <RefreshCw size={14} /> Retry
      </button>
    </div>
  );
}
