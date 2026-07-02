import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import YAML from "yaml";
import {
  findSecrets,
  PlaybookSecretError,
  validate,
  type Playbook,
} from "./schema";
import { parseSnapshot } from "./snapshot";
import { opEnv } from "./config";

/** True when this process should render a hosted snapshot instead of local disk. */
export function snapshotSource(): { file?: string; url?: string } | null {
  const file = opEnv("SNAPSHOT_FILE");
  const url = opEnv("SNAPSHOT_URL");
  return file || url ? { file, url } : null;
}

/**
 * Where to look for playbooks, in order:
 *   1. $OP_PLAYBOOKS_DIR     (your symlink farm, e.g. ~/playbooks)
 *   2. ~/playbooks            (the convention)
 *   3. ./examples/playbooks   (bundled safe demo data, so a fresh clone Just Works)
 */
export async function playbooksDir(): Promise<{ dir: string; isExample: boolean }> {
  const candidates = [
    opEnv("PLAYBOOKS_DIR"),
    path.join(os.homedir(), "playbooks"),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (await hasYaml(dir)) return { dir, isExample: false };
  }
  return { dir: path.join(process.cwd(), "examples", "playbooks"), isExample: true };
}

async function hasYaml(dir: string): Promise<boolean> {
  try {
    const files = await fs.readdir(dir);
    return files.some((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
  } catch {
    return false;
  }
}

export interface LoadResult {
  playbooks: Playbook[];
  isExample: boolean;
  dir: string;
  errors: { file: string; message: string }[];
  /** Set only in hosted mode: when the rendered snapshot was taken (ISO). */
  snapshotTakenAt?: string;
}

/**
 * Load the hosted snapshot bundle, if one is configured. The dashboard running
 * on Vercel reads its apps from here instead of scanning a local disk it doesn't
 * have. `OP_SNAPSHOT_FILE` (local path, for testing) wins over
 * `OP_SNAPSHOT_URL` (the Blob URL, in production).
 */
async function loadFromSnapshot(src: { file?: string; url?: string }): Promise<LoadResult> {
  const where = src.file ?? src.url!;
  try {
    const raw = src.file
      ? await fs.readFile(src.file, "utf8")
      : await (await fetch(src.url!, { cache: "no-store" })).text();
    const snap = parseSnapshot(raw);
    return {
      playbooks: snap.playbooks,
      isExample: false,
      dir: where,
      errors: [],
      snapshotTakenAt: snap.takenAt,
    };
  } catch (e) {
    return {
      playbooks: [],
      isExample: false,
      dir: where,
      errors: [{ file: "snapshot", message: e instanceof Error ? e.message : String(e) }],
    };
  }
}

/**
 * @param opts.committedOnly Skip the gitignored local overlay. Used by
 *   `1op publish` so a snapshot never carries the sensitive bits.
 */
export async function loadPlaybooks(opts?: { committedOnly?: boolean }): Promise<LoadResult> {
  // Hosted render: read the projected bundle, not the (absent) local disk.
  // `committedOnly` is a local publish path, so it always reads from disk.
  const hosted = snapshotSource();
  if (hosted && !opts?.committedOnly) return loadFromSnapshot(hosted);

  const { dir, isExample } = await playbooksDir();
  const files = (await fs.readdir(dir))
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  // Only the COMMITTED base files; their .local.yaml siblings are overlays.
  const baseFiles = files.filter((f) => !f.includes(".local."));

  const playbooks: Playbook[] = [];
  const errors: { file: string; message: string }[] = [];

  for (const f of baseFiles) {
    const full = path.join(dir, f);
    try {
      const raw = await fs.readFile(full, "utf8");

      // The committed file is the one that must never hold a secret — it goes
      // to git. Trip hard if it does.
      const hits = findSecrets(raw);
      if (hits.length) throw new PlaybookSecretError(f, hits);

      let merged = validate(YAML.parse(raw) ?? {}, full) as Playbook;

      // Overlay the gitignored local file if present. This is the sanctioned
      // home for sensitive bits, so it is NOT secret-scanned — it never reaches
      // git. `committedOnly` (publish) skips it so it never reaches a snapshot.
      if (!opts?.committedOnly) {
        const overlay = await readLocalOverlay(full);
        if (overlay) merged = mergePlaybook(merged, overlay);
      }

      playbooks.push(merged);
    } catch (e) {
      errors.push({ file: f, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return { playbooks, isExample, dir, errors };
}

/**
 * Find the gitignored local overlay for a base playbook. We look both next to
 * the file as named in the dir AND next to the symlink's real target (so a repo
 * can keep `.ops/playbook.local.yaml` and only symlink the base file).
 */
async function readLocalOverlay(baseFull: string): Promise<Partial<Playbook> | null> {
  const candidates = new Set<string>();
  const toLocal = (p: string) => p.replace(/(\.ya?ml)$/, ".local$1");
  candidates.add(toLocal(baseFull));
  try {
    const real = await fs.realpath(baseFull);
    if (real !== baseFull) candidates.add(toLocal(real));
  } catch {
    /* not a symlink / unreadable — fine */
  }
  for (const c of candidates) {
    try {
      const raw = await fs.readFile(c, "utf8");
      return (YAML.parse(raw) ?? {}) as Partial<Playbook>;
    } catch {
      /* no overlay here */
    }
  }
  return null;
}

/** Overlay `local` onto `base`: scalars and arrays from local win; envs merge per-env. */
function mergePlaybook(base: Playbook, local: Partial<Playbook>): Playbook {
  const out: Playbook = { ...base, ...local, _file: base._file };
  out.envs = { ...base.envs };
  for (const k of Object.keys(local.envs ?? {}) as (keyof typeof out.envs)[]) {
    out.envs[k] = { ...base.envs[k], ...local.envs![k] };
  }
  return out;
}

/**
 * Read dev credentials live from the committed seed file. We return the raw
 * snippet rather than trying to parse arbitrary seed code — the human reads it,
 * and it is always current because it IS the source of truth.
 */
export async function readSeed(
  pb: Playbook,
  seedFile: string
): Promise<{ ok: true; content: string; path: string } | { ok: false; error: string }> {
  // Hosted: the repo isn't on this machine, and dev creds are localhost-only
  // anyway. Point the human back to their own box rather than failing cryptically.
  if (snapshotSource()) {
    return { ok: false, error: "dev seed lives on your machine — run `1op creds <app> --reveal` there" };
  }
  const base = pb.repoRoot
    ? pb.repoRoot
    : pb._file
      ? path.dirname(pb._file)
      : process.cwd();
  const resolved = path.resolve(base, seedFile);
  try {
    const content = await fs.readFile(resolved, "utf8");
    return { ok: true, content, path: resolved };
  } catch {
    return { ok: false, error: `Could not read seed file at ${resolved}` };
  }
}
