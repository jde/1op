# Contributing to oneop

Thanks for wanting to help. oneop is small on purpose — a sharp tool, not a
platform. Contributions that keep it sharp are very welcome.

## The one non-negotiable rule

**oneop never stores a secret.** Every feature must preserve this. If a change
would cause oneop to store, commit, render to a deployable surface, or transmit
a real credential, it won't be merged — no matter how convenient. Pointers
(seed-file paths, 1Password item names) only. When in doubt, read
[`SECURITY.md`](SECURITY.md) and [`docs/SCHEMA.md`](docs/SCHEMA.md).

## Setup

```sh
git clone https://github.com/jde/oneop.git
cd oneop
pnpm install
pnpm dev          # dashboard on http://localhost:1134 with example data
pnpm oneop list   # try the CLI against the bundled examples
```

Node `>=20` and `pnpm` are expected.

## Before you open a PR

```sh
pnpm typecheck    # tsc --noEmit — must pass
pnpm build        # next build — must pass
```

CI runs both on every PR. Please also:

- Keep the example playbooks (`examples/`) working — they're how a fresh clone
  proves it runs, and how new contributors learn the schema.
- If you touch the schema, update [`docs/SCHEMA.md`](docs/SCHEMA.md) and the
  `generate-playbook` skill in the same PR.
- If you add CLI behavior, show the actual command output in the PR description.
  We verify by observation, not by assertion.

## Style

Match the surrounding code — it's plain TypeScript, no framework ceremony. Small,
readable functions over clever ones. Comments explain *why*, not *what*.

## Reporting bugs / proposing features

Use the issue templates. For anything security-related, **do not** open a public
issue — follow [`SECURITY.md`](SECURITY.md).
