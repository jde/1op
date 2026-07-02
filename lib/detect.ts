import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Filesystem detection for `1op init`. Reads only NON-SECRET facts (package
 * scripts, lockfiles, the PORT number, seed-file paths). It never reads or
 * stores a credential value — a generated playbook holds pointers only.
 */

export interface Detected {
  dir: string;
  app: string;
  packageManager?: "pnpm" | "yarn" | "npm" | "bun";
  start?: string;
  url?: string;
  seedFile?: string;
  resetCmd?: string; // db:reset — clear + baseline
  seedCmd?: string; // db:seed — userland
}

/** Immediate subdirectories of `root` that look like a project. */
export function findProjects(root: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    if (e.startsWith(".")) continue;
    const dir = path.join(root, e);
    try {
      if (!statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    if (existsSync(path.join(dir, "package.json")) || existsSync(path.join(dir, ".git"))) {
      out.push(dir);
    }
  }
  return out.sort();
}

function readJSON(p: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function packageManager(dir: string): Detected["packageManager"] | undefined {
  if (existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(path.join(dir, "yarn.lock"))) return "yarn";
  if (existsSync(path.join(dir, "bun.lockb"))) return "bun";
  if (existsSync(path.join(dir, "package-lock.json"))) return "npm";
  return undefined;
}

function runCmd(pm: string | undefined, script: string): string {
  const m = pm ?? "npm";
  return m === "npm" ? `npm run ${script}` : `${m} ${script}`;
}

/** Extract just the PORT integer from an env file. The number is not a secret. */
function portFromEnv(dir: string): number | undefined {
  for (const f of [".env", ".env.local", ".env.example", ".env.development"]) {
    const p = path.join(dir, f);
    if (!existsSync(p)) continue;
    const m = readFileSync(p, "utf8").match(/^\s*PORT\s*=\s*"?(\d{2,5})"?/m);
    if (m) return Number(m[1]);
  }
  return undefined;
}

export function detectProject(dir: string): Detected {
  const pkg = readJSON(path.join(dir, "package.json"));
  const app = (pkg && typeof pkg.name === "string" && pkg.name) || path.basename(dir);
  const pm = packageManager(dir);
  const scripts = (pkg?.scripts as Record<string, string>) ?? {};
  const deps = {
    ...((pkg?.dependencies as Record<string, string>) ?? {}),
    ...((pkg?.devDependencies as Record<string, string>) ?? {}),
  };

  const start = scripts.dev ? runCmd(pm, "dev") : scripts.start ? runCmd(pm, "start") : undefined;

  let port = portFromEnv(dir);
  if (port == null) {
    if (deps.next) port = 3000;
    else if (deps.vite || deps.astro) port = 5173;
    else if (deps.express || deps.fastify) port = 3000;
  }
  const url = port ? `http://localhost:${port}` : undefined;

  let seedFile: string | undefined;
  for (const c of ["prisma/seed.ts", "prisma/seed.js", "seed.ts", "db/seed.ts", "src/db/seed.ts"]) {
    if (existsSync(path.join(dir, c))) {
      seedFile = c;
      break;
    }
  }
  let resetCmd: string | undefined;
  for (const k of ["db:reset", "reset:db", "reset"]) {
    if (scripts[k]) {
      resetCmd = runCmd(pm, k);
      break;
    }
  }
  let seedCmd: string | undefined;
  for (const k of ["db:seed", "seed", "prisma:seed"]) {
    if (scripts[k]) {
      seedCmd = runCmd(pm, k);
      break;
    }
  }

  return { dir, app, packageManager: pm, start, url, seedFile, resetCmd, seedCmd };
}

/** Build the starter playbook object (to be YAML-stringified). Pointers only. */
export function starterPlaybook(d: Detected): Record<string, unknown> {
  const dev: Record<string, unknown> = {};
  if (d.url) dev.url = d.url;
  if (d.start) dev.start = d.start;
  dev.accounts = d.seedFile
    ? { source: "seed", seedFile: d.seedFile, users: [] }
    : { source: "inline-nonsecret", note: "TODO: how do you log in to dev?" };

  const pb: Record<string, unknown> = { app: d.app };
  if (d.packageManager) pb.packageManager = d.packageManager;
  pb.type = "real"; // real | experiment | archived | … — filter the dashboard by this
  pb.weight = 5; // 1–10 priority; the dashboard sorts highest-first
  // Enforce the two-script data standard: always scaffold both, TODO what's missing.
  pb.data = {
    reset: d.resetCmd ?? "TODO: clear DB + load baseline (categories/tags/types/base data)",
    seed: d.seedCmd ?? "TODO: add userland sample data on top of baseline",
  };
  pb.envs = {
    dev,
    staging: { url: "TODO", accounts: { source: "vault", vaultItem: `${d.app} — staging` } },
    prod: { url: "TODO", accounts: { source: "vault", vaultItem: `${d.app} — production` } },
  };
  return pb;
}
