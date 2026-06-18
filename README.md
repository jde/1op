<div align="center">

# 🔑 oneop

**1Password's chaotic dev cousin.** · [oneop.dev](https://oneop.dev)

[![CI](https://github.com/jde/oneop/actions/workflows/ci.yml/badge.svg)](https://github.com/jde/oneop/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
![Stores zero secrets](https://img.shields.io/badge/secrets%20stored-0-success)

</div>

---

You have a dozen apps. Each has a dev URL, a staging URL, a prod URL, a package
manager you can never remember, a seed script that creates dev logins you've
forgotten, and three integrations whose dashboards live in your browser history.
1Password is great for the stable secrets — and useless for all of *that*,
because *that* changes every week.

oneop is the place you look first and always get where you're going. It's a
dashboard of every app: URLs, the commands (and which folder to run them in),
your seeded dev logins, and a cue for where the real creds live — **without ever
storing a single secret.**

> It's like a password manager, except it refuses to know any passwords. By
> design. We talked about it in therapy.

## The trick: it stores pointers, not values

A dev environment is chaos because its *values* churn — ports move, databases
get reseeded, previews get torn down. So oneop never stores values. It stores the
**source** of the value, which doesn't churn:

| Thing you forget | What oneop stores | Why it never goes stale |
|---|---|---|
| Dev login | The path to your committed `seed.ts` | It's the actual source of truth; read live |
| Staging / prod creds | The **name** of the 1Password item | A label, not a secret |
| Which command, which folder | `pnpm dev` in `apps/web/` | It's in your repo already |
| That one integration dashboard | Its URL + vault item name | Just a bookmark |

Seeded dev users are **public** — they only work on `localhost` and they already
live in your committed code. So oneop shows them to you directly. Everything
genuinely sensitive stays in 1Password, or in a per-repo file git never sees.

## Where data lives (and what this repo is)

**This repo** ships the dashboard + the LLM skills + the docs. It contains **no
data about your apps.** The data lives in each of *your* repos:

```
your-app/
  .ops/
    playbook.yaml         ✅ committed — the maximum safe-to-publish info
    playbook.local.yaml   🚫 gitignored — the rare sensitive bit, never leaves your machine
```

We never store anything sensitive — not in this repo, not in any database, and
nothing that belongs to anyone else. There is no central database. It's your
files, on your machine, rendered.

## Quickstart

```sh
pnpm install
pnpm dev          # http://localhost:1134 — boots with fake EXAMPLE data
```

> Why port 1134? Flip it upside down on a calculator. `1134` → **hELL**. A
> dashboard that tames dev chaos belongs on port HELL.

Point it at your real apps:

```sh
export ONEOP_PLAYBOOKS_DIR="$HOME/playbooks"   # or anywhere
# then, in each app, generate a playbook (see below) and symlink it in
```

## Onboarding your projects

### Fast path: `oneop init` (scans the filesystem for you)

Point it at the folder that holds your repos. It scans every subdirectory that
looks like a project and writes a starter `.ops/playbook.yaml` into each —
detecting the package manager, the dev command, the port, and the seed file. It
**only reads non-secret facts** (scripts, lockfiles, the `PORT` number, seed-file
paths); it never copies a credential.

```sh
oneop init ~/code --dry      # preview what it would create, write nothing
oneop init ~/code --link     # create the files AND symlink them into ~/playbooks
export ONEOP_PLAYBOOKS_DIR="$HOME/playbooks" && pnpm dev   # see them on the dashboard
```

It skips any repo that already has a playbook, gitignores the
`.ops/*.local.yaml` overlay, and leaves `TODO`s where it needs a human (staging
URLs, which 1Password item, your seeded dev users). Fill those in per
[`docs/SCHEMA.md`](docs/SCHEMA.md).

### Rich path: the `generate-playbook` skill

For a single repo where you want an LLM to also mirror seeded dev users and
detect integrations, run the **`generate-playbook`** skill in `skills/`. Same
output, more detail filled in.

## The CLI — your dev keyring, and an agent's too

oneop ships a CLI built to be driven by **both you and a coding agent** (so the
agent can log in and read your errors instead of you copy-pasting them):

```sh
oneop init ~/code --link                # scan a folder, scaffold a playbook per project
oneop list                              # every app it knows about
oneop creds acme-web                    # dev logins — REDACTED by default
oneop creds acme-web --reveal           # show dev passwords
oneop creds acme-web --json             # structured, for an agent to drive with
oneop creds acme-web --env prod --json  # POINTER ONLY — oneop never holds prod creds
oneop env  acme-web                     # preview .env from declared deps (dry run)
oneop env  acme-web --write             # write missing dep keys — never clobbers yours
oneop run  acme-web                     # run its start cmd, capturing logs
oneop logs acme-web --errors --since 5m --json   # you OR the agent read live errors
```

The bright line, enforced in code: **dev creds are public (seeded, localhost-only)
and an agent may use them; staging/prod return only a 1Password item name an agent
cannot dereference.** Passwords are redacted unless you ask with `--reveal`/`--json`.

## Security promise

- Playbooks store **pointers, never secrets**.
- The loader **hard-refuses** any committed playbook that looks like it contains
  a key, token, or private key.
- The only sanctioned home for sensitive values is `playbook.local.yaml`, which
  is gitignored and never reaches this repo or any server.
- Deploy it if you want it on your phone — but it only ever renders pointers, so
  there's nothing to leak.

See [`docs/SCHEMA.md`](docs/SCHEMA.md) for the full contract.

If you ever find a way to make oneop leak a secret, that's a security bug, not a
feature request — see [`SECURITY.md`](SECURITY.md).

## Status

Early but real (`v0.1`). The dashboard, the playbook contract + secret tripwire,
the `generate-playbook` skill, and the `oneop` CLI (`list` / `creds` / `env` /
`run` / `logs`) all work and are exercised in CI. Standing up dependency
containers (`oneop up` / `bootstrap`) is designed into the schema but not yet
built — see [the roadmap](#roadmap).

## Roadmap

- `oneop scan` / `status` + a standard `/health` endpoint convention
- `oneop up` / `bootstrap` — stand up declared deps (db/cache/queue/storage) and
  seed, turning a fresh checkout into a running dev env in one command
- A `*.localhost` reverse proxy so you never type a port again

## Contributing

PRs welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup and the one
non-negotiable rule (oneop never stores a secret), and
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for how we treat each other.

## License

[MIT](LICENSE). Go nuts.
