# The 1op playbook contract

One playbook per repo, at `/.ops/playbook.yaml`. It stores **pointers, never
secrets**. The dashboard reads many playbooks and renders one card per app.

## Two files per repo

| File | Committed? | Holds |
|---|---|---|
| `.ops/playbook.yaml` | ✅ yes | Everything safe to publish: commands, URLs, seed-file pointer, **seeded dev users (public)**, integration names |
| `.ops/playbook.local.yaml` | 🚫 never (gitignored) | The rare genuinely-sensitive bit you still want on your dashboard |

The dashboard merges them (local overlays base). The goal: **check in the
maximum amount of information**, and quarantine only the little that's sensitive
into a file git never sees.

## Fields

```yaml
app: acme-web                      # required. one per repo.
description: Marketing + dashboard # optional
repo: https://github.com/acme/web  # optional
packageManager: pnpm               # npm | pnpm | yarn | bun
type: real                         # free-form: real | experiment | archived | …  (filter the dashboard by it)
weight: 9                          # 1–10 priority; the dashboard sorts highest-first

# Key commands and WHICH FOLDER to run them in (monorepo lifesaver)
commands:
  - { label: install, run: pnpm install }
  - { label: dev (web), run: pnpm dev, cwd: apps/web }

envs:                              # required. dev | staging | prod, all optional.
  dev:
    url: http://localhost:3000
    start: pnpm dev
    seedCmd: pnpm db:seed
    accounts:
      source: seed                 # read live from committed code…
      seedFile: prisma/seed.ts     # …this file. Path only, never the values.
    gotchas:
      - run docker compose up db first
  staging:
    url: https://staging.acme.dev
    accounts:
      source: vault                # a 1Password item NAME
      vaultItem: Acme — staging
  prod:
    url: https://acme.com
    accounts: { source: vault, vaultItem: Acme — production }

# Third-party services. Names + dashboards + vault item names. Never keys.
integrations:
  - { name: Stripe, url: https://dashboard.stripe.com, vaultItem: Acme — Stripe }
```

## Filtering & sorting: `type` and `weight`

So you can cut a wall of apps down to the ones you want right now:

| Field | Values | What it does |
|---|---|---|
| `type` | any string — `real`, `experiment`, `archived`, … | The dashboard's **type** dropdown is built from the types your playbooks actually use; pick one to show only those. `1op list --type experiment` does the same on the CLI. |
| `weight` | `1`–`10` (10 = most important) | The dashboard sorts **weight high→low** by default so your load-bearing apps sit at the top; unweighted apps sink to the bottom. Switch to A→Z with the **sort** dropdown or `1op list --sort name`. |

Both are optional and free of consequence — they only affect ordering and
filtering, never what's stored. `1op init` scaffolds `type: real`, `weight: 5`
so new apps start sortable; adjust per repo.

## `accounts.source` values

| source | use for | what you write |
|---|---|---|
| `seed` | dev | `seedFile:` — path to the committed seed file. Read live. |
| `vault` | staging / prod | `vaultItem:` — the 1Password item NAME, never its contents |
| `inline-nonsecret` | dev with no auth | `note:` — e.g. "no auth in dev" |

## The data standard (enforced)

Every app with a database declares **two** scripts — 1op holds the line via
`1op check`:

```yaml
data:
  reset: pnpm db:reset   # clears the DB + loads the BASELINE
  seed: pnpm db:seed     # adds USERLAND sample data on top
```

| Script | Clears DB? | Loads | Mental model |
|---|---|---|---|
| `reset` | yes | Baseline: categories, tags, types, required image uploads, base data | "factory, no users" |
| `seed` | no (assumes reset ran) | Userland sample data so the app isn't empty | "as if people have used it" |

- `1op check [app]` reports compliance and exits non-zero if any app is
  missing either — so CI can gate on it.
- `1op data <app> reset|seed|fresh` runs them; `fresh` = reset then seed, in
  order. It refuses a `TODO` placeholder and warns if you seed with no baseline.

## The one rule

If a value would be unsafe in a public repo, it does not go in `playbook.yaml`.
It goes in `playbook.local.yaml` (gitignored) or stays in 1Password. The loader
hard-refuses any committed playbook that trips its secret scanner.
