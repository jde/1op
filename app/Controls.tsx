"use client";

import { useRouter, useSearchParams } from "next/navigation";

/**
 * The dashboard filter/sort bar. It owns no state of its own — the URL search
 * params are the source of truth (`?type=…&sort=…`), so the server can read the
 * same values and render the already-filtered, already-sorted card list. This
 * component just rewrites the query string when you change a dropdown.
 */
export function Controls({ types, count, total }: { types: string[]; count: number; total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const type = params.get("type") ?? "";
  const sort = params.get("sort") ?? "weight";

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="controls">
      <label className="control">
        <span>type</span>
        <select value={type} onChange={(e) => setParam("type", e.target.value)}>
          <option value="">all</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>

      <label className="control">
        <span>sort</span>
        <select value={sort} onChange={(e) => setParam("sort", e.target.value)}>
          <option value="weight">weight ↓</option>
          <option value="name">name A→Z</option>
        </select>
      </label>

      <span className="control-count">
        {count === total ? `${total} app${total === 1 ? "" : "s"}` : `${count} of ${total}`}
      </span>
    </div>
  );
}
