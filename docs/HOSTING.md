# Hosting 1op (the read replica)

1op's source of truth is the `.ops/playbook.yaml` in each of your repos. The
hosted dashboard — e.g. **1op.dev**, for when you're away from your machine and
driving Claude Code by remote — is a **read replica** fed by an explicit
snapshot. The repos stay authoritative; the snapshot is a derived, disposable
projection you can regenerate any time.

```
repos (.ops/playbook.yaml)         ← authoring truth
        │  1op publish  (committed base only, dev creds redacted, secret-scanned)
        ▼
   snapshot bundle  { takenAt, redacted, playbooks[] }
        │  → Vercel Blob (public, stable key, overwritten in place)
        ▼
   hosted dashboard (force-dynamic) ← fetches the bundle per request
        │  Basic Auth at the edge (middleware.ts)
        ▼
        📱 you, on the go
```

## Why this is safe to put on the internet

Two invariants, enforced in code (`lib/snapshot.ts`):

1. **Committed base only.** `1op publish` loads with `committedOnly`, so the
   gitignored `playbook.local.yaml` overlay never enters a snapshot.
2. **Dev creds redacted at publish time.** Seeded dev logins are localhost-only
   and useless from a phone, so the bundle keeps the identity + role and drops
   the password. The bundle is then re-scanned with the same secret tripwire the
   loader uses — publishing aborts if anything secret-shaped slips through.

So the hosted view is pointers only. Basic Auth protects *access* (your app
inventory is nobody's business), not data.

## One-time setup

1. **Create a Blob store** and link it to the Vercel project:
   ```sh
   vercel blob create-store 1op-snap --access public --yes
   ```
   This injects `BLOB_READ_WRITE_TOKEN` into the project and writes it to
   `.env.local` (gitignored).

2. **Publish once** to populate the blob and learn its URL:
   ```sh
   export $(grep BLOB_READ_WRITE_TOKEN .env.local | xargs)
   1op publish --json        # → { url: "https://<store>.public.blob.vercel-storage.com/1op/snapshot.json" }
   ```

3. **Point the dashboard at it.** Set on the Vercel project (production):
   ```sh
   vercel env add OP_SNAPSHOT_URL production --value "<that url>" --yes
   ```
   When `OP_SNAPSHOT_URL` is set, `loadPlaybooks()` reads the bundle instead
   of scanning a local disk it doesn't have.

4. **Gate the domain.** Vercel Authentication (SSO) doesn't cover custom
   production domains on the Hobby plan, so 1op ships an edge Basic Auth gate
   (`middleware.ts`). Set:
   ```sh
   vercel env add OP_AUTH_USER production --value 1op --yes
   vercel env add OP_AUTH_PASSWORD production --value "<a strong password>" --yes
   ```
   The gate activates only when `OP_AUTH_PASSWORD` is set, so local dev and a
   fresh clone stay open. On **Pro**, you can instead use native Vercel
   Authentication (`ssoProtection.deploymentType = "all"`) and delete the
   middleware.

5. **Deploy:** `vercel --prod`.

## Keeping it fresh

The snapshot is a point-in-time copy — the dashboard shows "taken N ago" so you
always know how stale it is. Refresh it by re-running `1op publish`. Two ways
to automate that:

| Trigger | Command | When |
|---|---|---|
| **Staging-push flow** | `1op publish` | Have Claude run it after pushing to staging during remote control, so the phone view reflects the deploy you just asked for. Add it to the repo's `CLAUDE.md`. |
| **Watch daemon** | `1op watch` | Long-running; republishes (debounced) whenever any playbook under `OP_PLAYBOOKS_DIR` changes. Needs `BLOB_READ_WRITE_TOKEN` in its environment. |

`1op publish` also takes `--out <file>` (write the bundle locally, no upload —
handy for testing or a git-backed deploy) and `--dry` (preview size + count).

## Local testing without Vercel

Point a local dashboard at a bundle file to exercise hosted mode end-to-end:

```sh
1op publish --out /tmp/snap.json
OP_SNAPSHOT_FILE=/tmp/snap.json pnpm dev
```
