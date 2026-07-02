/**
 * The snapshot bundle — 1op's "read replica" payload.
 *
 * The per-repo `.ops/playbook.yaml` files are the source of truth. A snapshot is
 * a PROJECTION of them: the committed (pointer-only) playbooks, aggregated into
 * one JSON blob a hosted dashboard can render. It is derived and disposable —
 * re-run `1op publish` any time and the replica reconverges.
 *
 * Two invariants make a snapshot safe to put on the public internet:
 *   1. It carries the COMMITTED base only — never the gitignored local overlay.
 *   2. Dev-cred VALUES are stripped here, at publish time (redactSnapshot). Dev
 *      logins are localhost-only and useless from a phone anyway, so the hosted
 *      view keeps the identities (who/what role) and drops the passwords. The
 *      bundle that leaves your machine has nothing sensitive in it.
 */
import { findSecrets, type Playbook } from "./schema";

/** Bump when the bundle shape changes so a stale host can refuse to mis-render. */
export const SNAPSHOT_VERSION = 1;

/** Stable Blob path; `1op publish` overwrites it in place each run. */
export const SNAPSHOT_KEY = "1op/snapshot.json";

export interface Snapshot {
  version: number;
  takenAt: string; // ISO timestamp; the host shows "snapshot taken N ago"
  redacted: boolean; // always true for a published bundle — dev passwords stripped
  playbooks: Playbook[];
}

/**
 * Strip dev-cred values from a playbook for hosting. Keeps the seeded user's
 * identity + role (handy to know they exist) but drops the password/secret note
 * and the seedFile pointer's resolvability — the host has no repo to read.
 */
function redactPlaybook(pb: Playbook): Playbook {
  const out: Playbook = { ...pb, envs: { ...pb.envs } };
  for (const name of Object.keys(out.envs) as (keyof typeof out.envs)[]) {
    const env = out.envs[name];
    const acct = env?.accounts;
    if (env && acct?.source === "seed") {
      out.envs[name] = {
        ...env,
        accounts: {
          ...acct,
          users: acct.users?.map((u) => ({
            email: u.email,
            username: u.username,
            role: u.role,
            // password + free-form note dropped: localhost-only, never hosted.
          })),
        },
      };
    }
  }
  return out;
}

/** Build the bundle: redact every playbook, stamp it, and assert no secrets escaped. */
export function buildSnapshot(playbooks: Playbook[], takenAt: string): Snapshot {
  const redacted = playbooks.map((pb) => {
    // Drop loader-internal fields; they leak local absolute paths.
    const r = redactPlaybook(pb);
    delete r._file;
    delete r.repoRoot;
    return r;
  });

  const snap: Snapshot = {
    version: SNAPSHOT_VERSION,
    takenAt,
    redacted: true,
    playbooks: redacted,
  };

  // Belt-and-suspenders: a snapshot must never carry anything secret-shaped.
  const hits = findSecrets(JSON.stringify(snap));
  if (hits.length) {
    throw new Error(
      `Refusing to publish: the snapshot looks like it contains ${hits
        .map((h) => h.pattern)
        .join(", ")}. A playbook is leaking a value it should only point at.`
    );
  }
  return snap;
}

/** Parse + validate a fetched/loaded bundle. Throws on shape/version mismatch. */
export function parseSnapshot(raw: string): Snapshot {
  const obj = JSON.parse(raw) as Snapshot;
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.playbooks)) {
    throw new Error("snapshot: not a valid bundle (missing playbooks[])");
  }
  if (obj.version !== SNAPSHOT_VERSION) {
    throw new Error(`snapshot: version ${obj.version} != expected ${SNAPSHOT_VERSION} — republish with this 1op`);
  }
  return obj;
}
