/**
 * Environment configuration for 1op.
 *
 * All 1op env vars use the `OP_` prefix (the project is "1op"; env var names
 * can't start with a digit). Note the deliberate overlap with 1Password's own
 * `OP_*` CLI variables — the names here (PLAYBOOKS_DIR, SNAPSHOT_URL,
 * AUTH_PASSWORD, …) don't collide with any 1Password variable, but keep that
 * namespace in mind when adding new ones.
 */
export function opEnv(name: string): string | undefined {
  return process.env[`OP_${name}`];
}
