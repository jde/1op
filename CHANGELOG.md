# Changelog

All notable changes to oneop are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
