"use client";

import { useState, type ReactNode } from "react";

/**
 * Collapsible shell for an app card. Cards start MINIMIZED — just the app name
 * and a caret — so the dashboard is a scannable list; click the header to
 * toggle the full card (commands, envs, integrations) open or closed.
 *
 * The body is rendered on the server and handed in as `children`; this client
 * component only owns the open/closed state, so the async seed-file reads inside
 * the body keep working untouched.
 */
export function CardShell({
  app,
  meta,
  children,
}: {
  app: string;
  meta: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`app-card ${open ? "open" : "collapsed"}`}>
      <button
        type="button"
        className="card-toggle"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="caret" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <h2>{app}</h2>
      </button>
      {open && (
        <div className="card-body">
          <div className="head meta">{meta}</div>
          {children}
        </div>
      )}
    </section>
  );
}
