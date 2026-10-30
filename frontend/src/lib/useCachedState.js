import { useState, useCallback } from "react";

/* Drop-in replacement for useState that persists the value in localStorage.
   On mount it returns the last cached value instantly (stale-while-revalidate),
   so pages paint immediately while fresh data loads in the background. */
export function useCachedState(key, initial) {
  const ck = `tgx_cache_${key}`;
  const [value, setValue] = useState(() => {
    try {
      const cached = localStorage.getItem(ck);
      if (cached !== null) return JSON.parse(cached);
    } catch {}
    return initial;
  });

  const set = useCallback(
    (val) => {
      setValue((prev) => {
        const next = typeof val === "function" ? val(prev) : val;
        try {
          localStorage.setItem(ck, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [ck]
  );

  return [value, set];
}
