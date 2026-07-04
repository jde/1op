import { loadPlaybooks, readSeed } from "@/lib/playbooks";
import {
  ENV_ORDER,
  byWeightThenName,
  projectTypes,
  type EnvSpec,
  type Integration,
  type Playbook,
} from "@/lib/schema";
import { Controls } from "./Controls";
import { EnvTabs } from "./EnvTabs";
import { CardShell } from "./CardShell";

export const dynamic = "force-dynamic"; // always read fresh from disk

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string }>;
}) {
  const { type, sort } = await searchParams;
  const { playbooks, isExample, dir, errors, snapshotTakenAt } = await loadPlaybooks();

  const types = projectTypes(playbooks);
  const filtered = type ? playbooks.filter((p) => p.type === type) : playbooks;
  const sorted =
    sort === "name"
      ? [...filtered].sort((a, b) => a.app.localeCompare(b.app))
      : [...filtered].sort(byWeightThenName);

  return (
    <main className="wrap">
      <header className="top">
        <h1>🔑 1op</h1>
        <span className="tag">your dev keyring — every app, every env, zero secrets stored</span>
      </header>

      {isExample && (
        <div className="banner warn">
          Showing bundled <strong>example</strong> data (all fake). Point{" "}
          <code>OP_PLAYBOOKS_DIR</code> at your symlink farm — or drop playbooks in{" "}
          <code>~/playbooks</code> — to see your real apps.
        </div>
      )}
      {snapshotTakenAt ? (
        <div className="banner">
          📸 Hosted snapshot of {playbooks.length} app{playbooks.length === 1 ? "" : "s"} — taken{" "}
          <strong>{timeAgo(snapshotTakenAt)}</strong>. Dev creds live on your machine; this view is
          pointers only.
        </div>
      ) : (
        !isExample && (
          <div className="banner">
            Reading {playbooks.length} playbook{playbooks.length === 1 ? "" : "s"} from <code>{dir}</code>.
          </div>
        )
      )}

      {errors.map((e) => (
        <div className="banner err" key={e.file}>
          <strong>{e.file}</strong>: {e.message}
        </div>
      ))}

      {playbooks.length > 0 && (
        <Controls types={types} count={sorted.length} total={playbooks.length} />
      )}

      {groupByType(sorted).map((group) => (
        <section className="type-group" key={group.name}>
          <h2 className="group-title">
            {group.name}
            <span className="group-count">{group.items.length}</span>
          </h2>
          {group.items.map((pb) => (
            <AppCard key={pb._file ?? pb.app} pb={pb} />
          ))}
        </section>
      ))}

      {playbooks.length > 0 && sorted.length === 0 && (
        <div className="banner">
          No apps of type <code>{type}</code>. <a href="/">Clear the filter.</a>
        </div>
      )}

      <footer className="foot">
        1op stores pointers, never secrets. Dev creds are read live from your seed files; staging &
        prod show only the name of the vault item to open.
      </footer>
    </main>
  );
}

function AppCard({ pb }: { pb: Playbook }) {
  const meta = (
    <>
      {pb.type && <span className="ptype">{pb.type}</span>}
      {typeof pb.weight === "number" && (
        <span className="weight" title="priority weight (1–10)">
          ⚖ {pb.weight}
        </span>
      )}
      {pb.packageManager && <span className="pm">{pb.packageManager}</span>}
      {pb.description && <span className="desc">{pb.description}</span>}
      {pb.repo && (
        <span className="desc">
          · <a href={pb.repo} target="_blank" rel="noopener noreferrer">repo ↗</a>
        </span>
      )}
    </>
  );

  return (
    <CardShell app={pb.app} meta={meta}>
      {pb.commands && pb.commands.length > 0 && (
        <div className="commands">
          {pb.commands.map((c, i) => (
            <div className="cmd" key={i}>
              <span className="cmd-label">{c.label}</span>
              <code>{c.run}</code>
              {c.cwd && <span className="cmd-cwd">in {c.cwd}/</span>}
            </div>
          ))}
        </div>
      )}

      {pb.dependencies && pb.dependencies.length > 0 && (
        <div className="deps">
          <span className="deps-title">deps</span>
          {pb.dependencies.map((d, i) => (
            <span className="dep" key={i}>
              {d.kind}
              {d.version ? ` ${d.version}` : ""}
              {d.port ? <span className="dep-port">:{d.port}</span> : null}
              {d.seed ? <span className="dep-seed">🌱</span> : null}
            </span>
          ))}
        </div>
      )}

      {pb.data && (pb.data.reset || pb.data.seed) && (
        <div className="data">
          <span className="data-title">data</span>
          {pb.data.reset && (
            <span className="data-cmd">
              <b>reset</b> <code>{pb.data.reset}</code> <em>baseline</em>
            </span>
          )}
          {pb.data.seed && (
            <span className="data-cmd">
              <b>seed</b> <code>{pb.data.seed}</code> <em>userland</em>
            </span>
          )}
        </div>
      )}

      <Envs pb={pb} />


      {pb.integrations && pb.integrations.length > 0 && (
        <div className="integrations">
          <span className="int-title">integrations</span>
          {pb.integrations.map((it, i) => (
            <IntegrationChip key={i} it={it} />
          ))}
        </div>
      )}
    </CardShell>
  );
}

/**
 * Group cards into separate lists by their `type` tag. The buckets render in a
 * fixed priority order (Professional → Experiments → Personal); any other tag
 * follows alphabetically, and anything untagged sinks to the bottom. Card order
 * WITHIN each group is preserved from the already-sorted input.
 */
const TYPE_ORDER = ["Professional", "Experiments", "Personal"];
const UNTAGGED = "Untagged";

function groupByType(playbooks: Playbook[]): { name: string; items: Playbook[] }[] {
  const groups = new Map<string, Playbook[]>();
  for (const pb of playbooks) {
    const key = pb.type?.trim() || UNTAGGED;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(pb);
  }
  const rank = (name: string) => {
    const i = TYPE_ORDER.indexOf(name);
    if (i !== -1) return [0, i, ""] as const;
    if (name === UNTAGGED) return [2, 0, name] as const;
    return [1, 0, name] as const;
  };
  return [...groups.entries()]
    .map(([name, items]) => ({ name, items }))
    .sort((a, b) => {
      const [ag, ai, an] = rank(a.name);
      const [bg, bi, bn] = rank(b.name);
      return ag - bg || ai - bi || an.localeCompare(bn);
    });
}

/** "6 min ago" / "2 hours ago" — how stale the hosted snapshot is at a glance. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  const units: [number, string][] = [
    [86400, "day"],
    [3600, "hour"],
    [60, "min"],
  ];
  for (const [size, label] of units) {
    if (secs >= size) {
      const n = Math.floor(secs / size);
      return `${n} ${label}${n === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

function IntegrationChip({ it }: { it: Integration }) {
  const label = it.url ? (
    <a href={it.url} target="_blank" rel="noopener noreferrer">
      {it.name} ↗
    </a>
  ) : (
    <span>{it.name}</span>
  );
  return (
    <span className="int" title={it.note}>
      {label}
      {it.vaultItem && <span className="int-vault">🔐 {it.vaultItem}</span>}
    </span>
  );
}

/**
 * One environment → a plain full-width cell. Two or three → tabs, so you scan
 * one env at a time instead of three competing columns. The cells are rendered
 * here (server) and handed to the client tab switcher already-built.
 */
function Envs({ pb }: { pb: Playbook }) {
  const present = ENV_ORDER.filter((name) => pb.envs[name]);
  if (present.length === 0) return null;

  const cells = present.map((name) => ({
    name,
    node: <EnvCell name={name} env={pb.envs[name]!} pb={pb} />,
  }));

  if (cells.length === 1) {
    return <div className="envs single">{cells[0].node}</div>;
  }
  return <EnvTabs envs={cells} />;
}

async function EnvCell({ name, env, pb }: { name: string; env: EnvSpec; pb: Playbook }) {
  return (
    <div className={`env ${name}`}>
      <div className="name">{name}</div>
      {env.url && (
        <a className="url" href={env.url} target="_blank" rel="noopener noreferrer">
          {env.url}
        </a>
      )}
      {env.start && (
        <div className="row">
          start: <code>{env.start}</code>
        </div>
      )}
      {env.seedCmd && (
        <div className="row">
          seed: <code>{env.seedCmd}</code>
        </div>
      )}
      <Accounts env={env} pb={pb} />
      {env.gotchas && env.gotchas.length > 0 && (
        <ul className="gotchas">
          {env.gotchas.map((g, i) => (
            <li key={i}>{g}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function Accounts({ env, pb }: { env: EnvSpec; pb: Playbook }) {
  const acct = env.accounts;
  if (!acct) return null;

  if (acct.source === "vault") {
    return (
      <div className="row">
        🔐 <span className="vault">1Password → {acct.vaultItem}</span>
      </div>
    );
  }
  if (acct.source === "inline-nonsecret") {
    return <div className="row">👤 {acct.note}</div>;
  }
  // seed: show structured users (agent-readable) + the live seed file underneath.
  const seed = acct.seedFile ? await readSeed(pb, acct.seedFile) : null;
  return (
    <div>
      {acct.users && acct.users.length > 0 && (
        <table className="users">
          <tbody>
            {acct.users.map((u, i) => (
              <tr key={i}>
                <td>{u.email ?? u.username}</td>
                <td>
                  <code>{u.password ?? u.note ?? "—"}</code>
                </td>
                <td className="role">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {seed && seed.ok && (
        <details className="seed">
          <summary>🌱 source of truth: {acct.seedFile}</summary>
          <pre>{seed.content.trim()}</pre>
        </details>
      )}
      {seed && !seed.ok && <div className="row">🌱 seed: {seed.error}</div>}
      {!acct.users && !seed && <div className="row">🌱 seed (no users mirrored)</div>}
    </div>
  );
}
