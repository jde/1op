# Security Policy

oneop's entire reason to exist is to help you handle access details **without
storing secrets.** So security isn't a side concern here — it's the product.

## The security model (what oneop promises)

- **Playbooks store pointers, never values.** A dev login is the *path* to your
  committed seed file. A staging/prod credential is the *name* of a 1Password
  item. Neither is the secret itself.
- **A secret tripwire.** The loader scans every committed playbook and
  **hard-refuses to load** one that looks like it contains a private key, an API
  token, a cloud key, or a JWT. It fails loud rather than render a leak.
- **Sensitive values have exactly one sanctioned home:** `playbook.local.yaml`,
  which is gitignored and never committed, never pushed, never deployed.
- **No central database.** oneop renders *your* files on *your* machine (or your
  own self-hosted deploy). It never stores anything belonging to anyone else.
- **The dev/prod line is enforced in code.** `oneop creds` will reveal seeded
  dev logins (public — they only work on localhost) but for staging/prod returns
  only a vault item name an agent or tool cannot dereference.

If you find a way to make oneop **store, render, commit, or transmit a real
secret**, that is a security vulnerability — please report it.

## Supported versions

oneop is pre-1.0. Security fixes land on `main` and the latest release.

| Version | Supported |
|---|---|
| `0.1.x` | ✅ |
| `< 0.1` | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

- Preferred: open a [private security advisory](https://github.com/jde/oneop/security/advisories/new).
- Or email **dave@rolldeep.co** with `oneop security` in the subject.

Include what you did, what leaked or could leak, and a minimal repro if you have
one. We aim to acknowledge within 72 hours and will credit you in the release
notes unless you'd rather stay anonymous.
