import { useEffect, useRef } from "react";

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  /** Called once the 4s undo window closes without the user tapping Undo. */
  onExpire: () => void;
}

/** Bottom toast with a 4s undo window — sits above the tab bar. Keeps latest callbacks in
 *  refs so the timer is only ever started once per mount, regardless of parent re-renders. */
export function UndoToast({ message, onUndo, onExpire }: UndoToastProps) {
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    const timer = setTimeout(() => expireRef.current(), 4000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-x-4 z-[60] flex items-center justify-between rounded-2xl border border-border bg-surface-elevated px-4 py-3 shadow-lg"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
    >
      <span className="text-[13px] font-semibold text-text-primary">{message}</span>
      <button type="button" onClick={onUndo} className="min-h-8 px-2 text-[13px] font-extrabold text-accent">
        Undo
      </button>
    </div>
  );
}
