import { useEffect, useState } from "react";
import { dayKey } from "@/lib/dateHelpers";

/** Today's local date key, kept current. An installed PWA can stay in memory for days, so a
 *  value computed once at mount would keep showing yesterday after midnight. Re-checks when
 *  the app comes back to the foreground and once a minute while it's open. */
export function useToday(): string {
  const [today, setToday] = useState(dayKey());

  useEffect(() => {
    const check = () => setToday(dayKey());
    const timer = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  return today;
}
