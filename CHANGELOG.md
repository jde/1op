# Changelog

All notable changes to oneop are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Enforced data standard.** A playbook declares two scripts — `data.reset`
  (clear DB + load baseline: categories/tags/types/base data) and `data.seed`
  (userland sample data on top). `oneop check [app]` reports compliance and exits
  non-zero (CI-gateable); `oneop data <app> reset|seed|fresh` runs them in order
  (`fresh` = reset then seed), refusing TODO placeholders and warning when there's
  no baseline. `oneop init` now scaffolds both (TODOs where missing) and the
  dashboard shows the data row.

### Fixed

- `oneop init --link` now symlinks playbooks that **already exist**, not only
  freshly-created ones — so a re-run or partial onboarding no longer leaves the
  dashboard empty. (Found by a context-free onboarding test.)

### Added

- `oneop init` now **excludes the oneop repo itself** and accepts
  `--exclude a,b` to skip folders by name, so pointing it at a parent directory
  no longer scaffolds into the tool's own repo.
- README notes that a playbook's app name comes from `package.json` `name` and
  may differ from the folder name.

## [0.1.0] — 2026-06-17

First public release. The "1Password for dev stuff" — a dashboard + CLI that
holds every app's access details as pointers, never secrets.

### Added

- **Playbook contract** — one `.ops/playbook.yaml` per repo describing URLs,
  commands (and the folder to run them in), package manager, dev logins, deps,
  and integrations. Pointers only.
- **Secret tripwire** — the loader hard-refuses any committed playbook that looks
  like it contains a private key, token, or cloud key.
- **Two-file model** — committed `playbook.yaml` plus a gitignored
  `playbook.local.yaml` overlay for the rare sensitive value.
- **Dashboard** (Next.js, port 1134) — renders every app; reads dev logins live
  from your seed files; falls back to bundled example data on a fresh clone.
- **CLI** — `oneop init` (scan a folder and scaffold a playbook per project),
  `list`, `creds` (redacted by default; dev-only values, stg/prod are pointers),
  `env` (merge-safe `.env` generation from declared deps), `run` (run with log
  capture), and `logs` (level-filtered, agent-readable).
- **`generate-playbook` skill** — richer single-repo onboarding.

[Unreleased]: https://github.com/jde/oneop/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/jde/oneop/releases/tag/v0.1.0
