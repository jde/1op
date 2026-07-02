/**
 * The 1op contract.
 *
 * A playbook describes how to GET INTO an app across environments. It stores
 * POINTERS, never secrets:
 *   - dev creds  -> the path to the committed seed file that defines them
 *   - stg/prod   -> the NAME of the 1Password item that holds them
 *
 * If a value would be unsafe to publish to a public repo, it does not belong
 * in a playbook. `assertNoSecrets()` below is the tripwire that enforces this.
 */

/**
 * A dev login an AGENT can drive with. Safe to publish: seeded dev users only
 * work on localhost and already live in committed code. Mirror them here (the
 * generate-playbook skill does this from the seed file) so agents get a
 * reliable, structured handle instead of parsing seed code at runtime.
 */
export interface DevUser {
  email?: string;
  username?: string;
  password?: string;
  role?: string;
  note?: string;
}

export type AccountSource =
  | { source: "seed"; seedFile?: string; users?: DevUser[] } // dev: from committed code; mirror users for agents
  | { source: "vault"; vaultItem: string } //  stg/prod: a 1Password item NAME, not its contents
  | { source: "inline-nonsecret"; note: string }; // e.g. "anyone@example.com / no password in dev"

export interface EnvSpec {
  url?: string;
  start?: string; // command to bring the env up (mostly dev)
  seedCmd?: string; // command that (re)seeds this env's data, e.g. "pnpm db:seed"
  accounts?: AccountSource;
  gotchas?: string[];
}

/** A key command and — crucially for monorepos — the folder you run it in. */
export interface Command {
  label: string; // "dev", "build", "test", "db reset"…
  run: string; // "pnpm dev"
  cwd?: string; // folder relative to repo root; omitted means repo root
}

/** A third-party service this app depends on. Pointers only, like everything else. */
export interface Integration {
  name: string; // "Stripe", "Sentry", "Resend"…
  url?: string; // dashboard URL
  vaultItem?: string; // 1Password item NAME for the account/keys (never the keys)
  note?: string; // e.g. "test mode keys in .env.example"
}

/**
 * A dev-environment dependency 1op can stand up locally (db, cache, queue,
 * object storage…). The `env` map is the magic: the connection strings this
 * dep populates in your `.env`. These are LOCAL and PUBLIC (localhost, default
 * local passwords) — safe to generate, just like seeded users.
 */
export interface Dependency {
  name: string; // "db", "cache", "queue", "storage"
  kind: string; // "postgres" | "mysql" | "redis" | "rabbitmq" | "minio" | …
  version?: string; // image tag, e.g. "16"
  port?: number; // host port; substituted for {port} in env values
  /** Env vars this dependency populates. `{port}` is replaced with `port`. */
  env?: Record<string, string>;
  /** True if this dep needs the app's seed step after it comes up. */
  seed?: boolean;
}

/**
 * The two-script data standard 1op enforces for dev work:
 *
 *   reset → clears the DB and loads the app BASELINE: the categories, tags,
 *           types, required image uploads, and base data the app needs to
 *           function at all. Deterministic foundation — "factory, no users".
 *   seed  → adds USERLAND sample data on top (assumes reset has run) so the app
 *           runs in a realistic, non-empty state.
 *
 * `1op check` flags any app missing either; `1op data <app> fresh` runs
 * them in the correct order (reset, then seed).
 */
export interface DataStandard {
  reset?: string; // clear + baseline
  seed?: string; // userland sample data on top of baseline
}

export interface Playbook {
  app: string;
  description?: string;
  repo?: string;
  /**
   * How you classify this project so you can filter the dashboard down to just
   * the ones you care about right now. Free-form — "real", "experiment",
   * "archived", whatever taxonomy you keep. SUGGESTED_TYPES are only hints for
   * the picker; you are not limited to them.
   */
  type?: string;
  /**
   * Priority weight, 1 (low) – 10 (high). The dashboard sorts by this so your
   * most important apps float to the top. Out-of-range or non-numeric values
   * are clamped/ignored at load time.
   */
  weight?: number;
  /** Resolve relative seedFile paths against this. Defaults to the playbook's own dir. */
  repoRoot?: string;
  /** npm | pnpm | yarn | bun — so you stop guessing which one this repo uses. */
  packageManager?: "npm" | "pnpm" | "yarn" | "bun";
  /** Key commands and where to run them. The monorepo lifesaver. */
  commands?: Command[];
  /** Local dev dependencies 1op can stand up + wire into .env. */
  dependencies?: Dependency[];
  /** The enforced two-script data standard: reset (baseline) + seed (userland). */
  data?: DataStandard;
  envs: Partial<Record<"dev" | "staging" | "prod", EnvSpec>>;
  /** Third-party services/accounts (Stripe, Sentry, …) — names & dashboards, never keys. */
  integrations?: Integration[];
  /** Internal: filled by the loader, not authored by hand. */
  _file?: string;
}

export const ENV_ORDER = ["dev", "staging", "prod"] as const;
export type EnvName = (typeof ENV_ORDER)[number];

/** Hints for the type picker. Not enforced — any string is valid. */
export const SUGGESTED_TYPES = ["real", "experiment", "archived"] as const;

/** Sort key for a playbook: its weight, or 0 so unweighted apps sink below weighted ones. */
export function weightOf(pb: Playbook): number {
  return typeof pb.weight === "number" ? pb.weight : 0;
}

/** Default dashboard order: weight high→low, ties broken by app name A→Z. */
export function byWeightThenName(a: Playbook, b: Playbook): number {
  return weightOf(b) - weightOf(a) || a.app.localeCompare(b.app);
}

/** The distinct, non-empty `type`s across a set of playbooks, sorted — drives the filter. */
export function projectTypes(pbs: Playbook[]): string[] {
  return [...new Set(pbs.map((p) => p.type).filter((t): t is string => !!t))].sort();
}

/**
 * Patterns that look like real secrets. A playbook that trips these is
 * rejected at load time — we would rather show an error than publish a leak.
 * (Seed FILE PATHS and 1Password item NAMES are fine; secret VALUES are not.)
 */
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "private key block", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "AWS access key id", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "OpenAI/Anthropic-style key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { name: "bearer/jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

export interface SecretHit {
  pattern: string;
  context: string;
}

/** Scan a raw playbook string for things that should never be committed. */
export function findSecrets(raw: string): SecretHit[] {
  const hits: SecretHit[] = [];
  for (const { name, re } of SECRET_PATTERNS) {
    const m = raw.match(re);
    if (m) hits.push({ pattern: name, context: m[0].slice(0, 12) + "…" });
  }
  return hits;
}

export class PlaybookSecretError extends Error {
  constructor(file: string, hits: SecretHit[]) {
    super(
      `Refusing to load "${file}": it looks like it contains ${hits
        .map((h) => h.pattern)
        .join(", ")}. Playbooks store POINTERS, not secrets. ` +
        `Replace the value with a seedFile path (dev) or a 1Password item name (stg/prod).`
    );
    this.name = "PlaybookSecretError";
  }
}

export interface DataCheck {
  app: string;
  ok: boolean;
  issues: string[];
}

/**
 * Enforce the two-script data standard. An app that declares data work must
 * define BOTH reset (baseline) and seed (userland). `seed` without `reset` is
 * the classic anti-pattern (a seed that quietly resets, or no clean baseline).
 */
export function checkDataStandard(pb: Playbook): DataCheck {
  const issues: string[] = [];
  const d = pb.data;
  // A TODO placeholder (from `1op init`) is not a real command.
  const real = (s?: string) => !!s && !s.trim().startsWith("TODO");
  const hasReset = real(d?.reset);
  const hasSeed = real(d?.seed);
  // A legacy single seedCmd counts as "doing data work" but not following the standard.
  const legacySeed = Object.values(pb.envs).some((e) => e?.seedCmd);

  if (!hasReset && !hasSeed) {
    if (legacySeed) issues.push("uses envs.*.seedCmd but no data.reset/seed — adopt the two-script standard");
    else if (d) issues.push("data.reset and data.seed are still TODO — fill them in");
    else issues.push("no data work declared (add data.reset + data.seed if this app has a database)");
  } else {
    if (!hasReset) issues.push("missing data.reset (clear DB + load baseline: categories/tags/types/base data)");
    if (!hasSeed) issues.push("missing data.seed (userland sample data on top of baseline)");
  }
  const ok = hasReset && hasSeed;
  return { app: pb.app, ok, issues: ok ? [] : issues };
}

/** Minimal shape validation so the dashboard fails loud, not weird. */
export function validate(p: unknown, file: string): Playbook {
  if (typeof p !== "object" || p === null) throw new Error(`${file}: not an object`);
  const obj = p as Record<string, unknown>;
  if (typeof obj.app !== "string" || !obj.app) throw new Error(`${file}: missing "app"`);
  if (typeof obj.envs !== "object" || obj.envs === null) throw new Error(`${file}: missing "envs"`);
  const pb = { ...(obj as object), _file: file } as Playbook;
  // Normalize the two filter/sort fields so the dashboard never chokes on a
  // stray blank string or an out-of-range weight someone typed by hand.
  pb.type = typeof pb.type === "string" && pb.type.trim() ? pb.type.trim() : undefined;
  if (pb.weight != null) {
    const n = Math.round(Number(pb.weight));
    pb.weight = Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : undefined;
  }
  return pb;
}
