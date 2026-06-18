## What & why

<!-- What does this change, and what problem does it solve? -->

## The non-negotiable

- [ ] This change does **not** cause oneop to store, commit, render to a
      deployable surface, or transmit a real secret. Pointers only.

## Verification

<!-- Paste the actual output that proves it works: CLI output, a screenshot,
     test results. We verify by observation, not assertion. -->

```
(paste output here)
```

## Checklist

- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` passes
- [ ] Updated `docs/SCHEMA.md` + the `generate-playbook` skill if the schema changed
- [ ] Updated `CHANGELOG.md` under `[Unreleased]`
