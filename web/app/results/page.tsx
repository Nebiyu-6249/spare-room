import type { Metadata } from "next";
import { BigNumber, Card, Path, RecordedNote, SectionTitle, SeverityTag, StateTag } from "@/components/ui";
import { ACCOUNT_NAMES, acct, CATEGORY_LABELS, cellsFor, countBy, cov, plain, scan, twin } from "@/lib/data";

export const metadata: Metadata = { title: "Results | Spare Room" };

// Coverage rows grouped by the report they come from, in first-seen order.
function bySource() {
  const groups: { name: string; url: string; rows: typeof cov }[] = [];
  for (const c of cov) {
    let g = groups.find((x) => x.name === c.attacker_source.name);
    if (!g) groups.push((g = { name: c.attacker_source.name, url: c.attacker_source.url, rows: [] }));
    g.rows.push(c);
  }
  return groups;
}

export default function Results() {
  const m = twin.matrix;
  const total = m.secrets.length;
  const yours = cellsFor("normal");
  const spare = cellsFor("interview");
  const v = acct.verify;
  const covered = cov.filter((c) => c.check_id).length;
  const bySev = countBy(scan.findings, (f) => f.severity);

  return (
    <div>
      <h1 className="text-4xl font-semibold">Results</h1>
      <div className="mt-3 max-w-3xl"><RecordedNote /></div>

      <SectionTitle>Your account and the spare room</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card><BigNumber value={`${yours.filter((c) => c === "visible").length} of ${total}`}
          label="fake secrets reachable from your account" tone="high" /></Card>
        <Card><BigNumber value={`${spare.filter((c) => c === "visible").length} of ${total}`}
          label="reachable from the spare room" tone="ok" /></Card>
      </div>
      <p className="mb-4 mt-6 max-w-3xl">
        The same check ran once from each account against the same 13 fake secrets, kept in a folder inside your
        account. It only asks whether each file exists and can be read. It never opens a file and never uses the network.
      </p>
      <div className="rounded-md border border-line bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Each fake secret, checked from your account and from the spare room</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-3 py-3 font-medium sm:px-4">Fake secret</th>
              {m.columns.map((c) => (
                <th scope="col" key={c.account_label} className="w-28 px-2 py-3 font-medium sm:w-44 sm:px-4">
                  {ACCOUNT_NAMES[c.account_label] ?? c.account_label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {m.secrets.map((s, i) => (
              <tr key={s.path} className="border-b border-line align-top last:border-0">
                <td className="px-3 py-2.5 sm:px-4">
                  <span className="block text-[13px] text-muted">{CATEGORY_LABELS[s.category] ?? s.category}</span>
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

      <SectionTitle>Checked from inside the spare room</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="mb-3 text-[15px] font-medium text-muted">Your other accounts</p>
          <BigNumber
            value={`${v.normal_profile_secret_locations - v.normal_profile_readable} of ${v.normal_profile_secret_locations}`}
            label="known secret locations out of reach. Windows denied access to every one." tone="ok" />
        </Card>
        <Card>
          <p className="mb-3 text-[15px] font-medium text-muted">Readable by every account</p>
          <BigNumber value={v.readable_env_outside_profiles.length}
            label={<>.env file outside any account folder:{" "}
              {v.readable_env_outside_profiles.map((p) => <Path key={p}>{p}</Path>)}. A separate account does not
              protect it.</>} tone="high" />
        </Card>
      </div>
      <p className="mt-4 max-w-3xl text-[15px] text-muted">
        The spare room&apos;s own files (a new account&apos;s browser and settings files, nothing of yours) are listed
        separately as information and are not counted as things stranger code could take.
      </p>

      <SectionTitle>Time to set up the spare room (Windows 11 Home)</SectionTitle>
      <div className="max-w-2xl rounded-md border border-line bg-card">
        <table className="w-full text-[15px]">
          <caption className="sr-only">Measured setup times</caption>
          <tbody>
            <tr className="border-b border-line">
              <th scope="row" className="px-4 py-2.5 text-left font-normal">Creating the account, start to finish</th>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums">{acct.setup_wall_s} s</td>
            </tr>
            <tr className="border-b border-line">
              <th scope="row" className="px-4 py-2.5 text-left font-normal">of which the Windows permission prompt and password</th>
              <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{(acct.setup_elevated_ms / 1000).toFixed(1)} s</td>
            </tr>
            <tr className="border-b border-line">
              <th scope="row" className="px-4 py-2.5 text-left font-normal">Safer settings inside the spare room</th>
              <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">under 1 s</td>
            </tr>
            <tr>
              <th scope="row" className="px-4 py-2.5 text-left font-normal">First sign-in (Windows builds the account)</th>
              <td className="whitespace-nowrap px-4 py-2.5 text-right text-muted">not timed</td>
            </tr>
          </tbody>
        </table>
      </div>

      <SectionTitle>Coverage of public attacker reports</SectionTitle>
      <p className="mb-4 max-w-3xl">
        {covered} of {cov.length} things these reports say attackers went after are covered by a check. Uncovered rows
        say why.
      </p>
      <div className="rounded-md border border-line bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Targets named in public attacker reports, grouped by report</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">Target</th>
              <th scope="col" className="w-32 px-3 py-2.5 font-medium sm:w-auto sm:px-4">Covered?</th>
            </tr>
          </thead>
          {bySource().map((g) => {
            const n = g.rows.filter((r) => r.check_id).length;
            return (
              <tbody key={g.name}>
                <tr className="border-b border-line bg-paper">
                  <th scope="colgroup" colSpan={2} className="px-3 py-2.5 text-left font-medium sm:px-4">
                    <a href={g.url} rel="noreferrer">{g.name}</a>
                    <span className="ml-2 font-normal text-muted">{n} of {g.rows.length} covered</span>
                  </th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={r.target} className="border-b border-line align-top">
                    <td className="px-3 py-2 sm:px-4">{r.target}</td>
                    <td className="px-3 py-2 sm:px-4">
                      {r.check_id ? <span className="text-ok">Yes</span> : <span className="text-muted">No. {r.note}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>

      <SectionTitle>Everything the scan found on the fake laptop</SectionTitle>
      <p className="mb-4 max-w-3xl">
        The two rooms use 13 fake secret files. The scan looks wider: it also reports settings, history and browser data
        around them, so on the same fake laptop it lists {scan.findings.length} findings in {scan.locations_checked}{" "}
        places checked ({bySev.high ?? 0} high, {bySev.medium ?? 0} medium, {bySev.info ?? 0} info).
      </p>
      <div className="space-y-3">
        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
          const items = scan.findings.filter((f) => f.category === cat);
          if (!items.length) return null;
          return (
            <details key={cat} className="rounded-md border border-line bg-card">
              <summary className="flex min-h-11 cursor-pointer items-center px-4 font-medium">{label} ({items.length})</summary>
              <ul className="space-y-4 px-4 pb-4">
                {items.map((f) => (
                  <li key={f.id} className="border-t border-line pt-3 text-[15px]">
                    <div className="flex flex-wrap items-center gap-3">
                      <SeverityTag level={f.severity} /> <span className="font-medium">{f.kind}</span>
                    </div>
                    <div className="mt-1"><Path>{f.path}</Path></div>
                    <p className="mt-1">{plain(f.reason)}</p>
                    <p className="mt-1 text-muted"><span className="font-medium text-ink">Fix:</span> {plain(f.fix)}</p>
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
