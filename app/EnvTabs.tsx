"use client";

import { useState, type ReactNode } from "react";

/**
 * Tabbed environments. The panels themselves are server-rendered (they read seed
 * files), so they arrive here as ready-made nodes — this component only owns
 * which one is visible. All panels stay in the DOM (hidden, not unmounted) so
 * switching tabs is instant and nothing re-fetches.
 */
export function EnvTabs({ envs }: { envs: { name: string; node: ReactNode }[] }) {
  const [active, setActive] = useState(envs[0]?.name);

  return (
    <div className="env-tabs">
      <div className="env-tablist" role="tablist">
        {envs.map((e) => (
          <button
            key={e.name}
            type="button"
            role="tab"
            aria-selected={e.name === active}
            className={`env-tab ${e.name}${e.name === active ? " active" : ""}`}
            onClick={() => setActive(e.name)}
          >
            {e.name}
          </button>
        ))}
      </div>
      {envs.map((e) => (
        <div key={e.name} role="tabpanel" hidden={e.name !== active} className="env-tabpanel">
          {e.node}
        </div>
      ))}
    </div>
  );
}
