import type { Metadata } from "next";
import { Card, Path, RecordedNote, SectionTitle, SeverityTag, StateTag } from "@/components/ui";
import { acct, CATEGORY_LABELS, cov, scan, twin } from "@/lib/data";

export const metadata: Metadata = { title: "Results | Spare Room" };

export default function Results() {
  const m = twin.matrix;
  const covered = cov.filter((c) => c.check_id).length;
  const v = acct.verify;

  return (
    <div>
      <h1 className="text-3xl font-semibold">Results</h1>
      <div className="mt-3"><RecordedNote /></div>

      <SectionTitle>Same probe, two accounts</SectionTitle>
      <p className="mb-4 max-w-2xl">
        The probe checks only whether each path exists and can be read. It never opens a file and never uses the
        network. It ran once from each account against the same copy of the fake laptop, kept inside the normal
        account&apos;s folder.
      </p>
      <div className="overflow-x-auto rounded-md border border-line bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="px-3 py-3 font-medium sm:px-4">Fake secret</th>
              {m.columns.map((c) => (
                <th key={c.account_label} className="w-24 px-2 py-3 font-medium sm:w-40 sm:px-4">
                  {c.account_label}<span className="hidden sm:inline"> account</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.secrets.map((s, i) => (
              <tr key={s.path} className="border-b border-line last:border-0 align-top">
                <td className="px-3 py-2.5 sm:px-4">
                  <span className="block text-xs text-muted">{CATEGORY_LABELS[s.category] ?? s.category}</span>
                  <Path>{s.path}</Path>
                </td>
                {m.columns.map((c) => (
                  <td key={c.account_label} className="px-2 py-2.5 sm:px-4"><StateTag state={c.cells[i]} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>verify, run inside the interview account</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-3xl font-semibold tabular-nums text-ok">
            {v.normal_profile_readable} of {v.normal_profile_secret_locations}
          </p>
          <p className="mt-1">known secret locations in the normal account&apos;s folder were readable. Windows denied
            access to every one.</p>
        </Card>
        <Card>
          <p className="text-3xl font-semibold tabular-nums text-high">{v.readable_env_outside_profiles.length}</p>
          <p className="mt-1">
            .env file outside any account folder was still readable:{" "}
            {v.readable_env_outside_profiles.map((p) => <Path key={p}>{p}</Path>)}. Every account on the PC can
            read it, so a separate account does not protect it. Move it into your own folder.
          </p>
        </Card>
      </div>

      <SectionTitle>Setup time (Windows 11 Home)</SectionTitle>
      <div className="overflow-x-auto rounded-md border border-line bg-card">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-line">
              <td className="px-4 py-2.5">setup, start to &quot;Created&quot;</td>
              <td className="px-4 py-2.5 font-medium tabular-nums">{acct.setup_wall_s} s</td>
            </tr>
            <tr className="border-b border-line">
              <td className="px-4 py-2.5">of which the permission prompt and password window</td>
              <td className="px-4 py-2.5 tabular-nums">{(acct.setup_elevated_ms / 1000).toFixed(1)} s</td>
            </tr>
            <tr className="border-b border-line">
              <td className="px-4 py-2.5">finish-setup (settings)</td>
              <td className="px-4 py-2.5 tabular-nums">under 1 s</td>
            </tr>
            <tr>
              <td className="px-4 py-2.5">first sign-in (Windows builds the profile)</td>
              <td className="px-4 py-2.5 text-muted">not timed</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SectionTitle>Coverage of public attacker target lists</SectionTitle>
      <p className="mb-4">
        {covered} of {cov.length} targets named in public reports are covered by a check. The rest say why not.
      </p>
      <ul className="space-y-2">
        {cov.map((c, i) => (
          <li key={i} className="rounded-md border border-line bg-card px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{c.target}</span>
              <span className={c.check_id ? "text-ok" : "text-muted"}>
                {c.check_id ? <code className="path">{c.check_id}</code> : "not covered"}
              </span>
            </div>
            {!c.check_id && <p className="mt-1 text-muted">{c.note}</p>}
            <a href={c.attacker_source.url} className="mt-1 inline-block text-xs" rel="noreferrer">
              {c.attacker_source.name}
            </a>
          </li>
        ))}
      </ul>

      <SectionTitle>Everything the fake-laptop scan listed</SectionTitle>
      <div className="space-y-3">
        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
          const items = scan.findings.filter((f) => f.category === cat);
          if (!items.length) return null;
          return (
            <details key={cat} className="rounded-md border border-line bg-card px-4 py-3">
              <summary className="cursor-pointer font-medium">{label} ({items.length})</summary>
              <ul className="mt-3 space-y-4">
                {items.map((f) => (
                  <li key={f.id} className="border-t border-line pt-3 text-sm">
                    <div className="flex flex-wrap items-center gap-3">
                      <SeverityTag level={f.severity} /> <span className="font-medium">{f.kind}</span>
                    </div>
                    <div className="mt-1"><Path>{f.path}</Path></div>
                    <p className="mt-1">{f.reason}</p>
                    <p className="mt-1 text-muted"><span className="font-medium text-ink">Fix:</span> {f.fix}</p>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}
