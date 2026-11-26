"use client";

// "Try it here, no download": Spare Room's rules, simulated on the fake laptop.
// Everything stays in this component's state: no network, no storage, nothing
// typed here leaves the page. The rules come from data/rules.json, generated
// from the Python source; see lib/playground.ts for what is and is not simulated.

import { useId, useMemo, useState } from "react";
import rulesJson from "@/data/rules.json";
import { SeverityTag } from "@/components/ui";
import { acct, REPO_URL, scan, SHORT_NAMES } from "@/lib/data";
import {
  buildPath, cleanEnvNames, cleanName, defaultItems, describe, placeOf, REACH_EVIDENCE, runProbe, variants,
  type AddType, type AddWhere, type Item, type Line, type Match, type Place, type Room, type RoomReport, type Rules,
} from "@/lib/playground";

const rules = rulesJson as unknown as Rules;
const HOME = `C:\\Users\\${rules.fake_laptop.home_user}`;
const BASE: Item[] = defaultItems(rules, SHORT_NAMES, scan.findings as (Match & { path: string })[],
  acct.verify.readable_env_outside_profiles);
const IN_PROFILE = BASE.filter((i) => i.origin === "fake_laptop").length;

const ROOM_TITLE: Record<Room, string> = { yours: "Your account", spare: "The spare room" };
const ROOM_LABEL: Record<Room, string> = { yours: "normal", spare: "interview" }; // the recorded runs' labels

const PLACE_TITLE: Record<Place, string> = {
  profile: "Your user folder",
  c_dev: "A folder at the top of C:",
  c_other: "A folder at the top of C:",
  public: "The Public folder",
  other_drive: "Another drive",
};
const PLACE_ORDER: Place[] = ["profile", "c_dev", "c_other", "public", "other_drive"];

const TYPES: { id: AddType; label: string }[] = [
  { id: "env", label: ".env file" },
  { id: "ssh", label: "SSH key" },
  { id: "cloud", label: "Cloud credentials" },
  { id: "wallet", label: "Crypto wallet" },
  { id: "browser", label: "Saved browser passwords" },
  { id: "any", label: "Any file name" },
];
const WHERE: { id: AddWhere; label: string; outside?: boolean }[] = [
  { id: "usual", label: "Its usual place in your user folder" },
  { id: "desktop", label: `Desktop (${HOME}\\Desktop)` },
  { id: "documents", label: `Documents (${HOME}\\Documents)` },
  { id: "project", label: `A project folder (${HOME}\\projects)` },
  { id: "public", label: "The Public folder (C:\\Users\\Public\\Documents)", outside: true },
  { id: "c_dev", label: "A folder at the top of C: (C:\\dev)", outside: true },
  { id: "d_work", label: "Another drive (D:\\work)", outside: true },
];

/** The trigger the fixture passes to the probe, read from its own tasks.json. */
function probeTrigger(trap: Rules["traps"][number]): string {
  const tasks = trap.files.find((f) => f.path.endsWith("tasks.json"));
  try {
    const args: string[] = JSON.parse(tasks?.text ?? "").tasks[0].args;
    return args[args.indexOf("--trigger") + 1] ?? trap.trigger;
  } catch {
    return trap.trigger;
  }
}

function shortPath(item: Item): string {
  const p = item.path;
  return placeOf(rules, p) === "profile" ? p.slice(HOME.length + 1) : p;
}

// ---- the fake laptop -------------------------------------------------------

function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" }) {
  return (
    <span className={`inline-block rounded-[3px] border px-1.5 py-px font-mono text-[13px] font-medium ${
      tone === "accent" ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-mist text-muted"}`}>
      {children}
    </span>
  );
}

function Laptop({ items, onRemove }: { items: Item[]; onRemove: (id: string) => void }) {
  const groups = PLACE_ORDER.map((place) => ({ place, items: items.filter((i) => placeOf(rules, i.path) === place) }))
    .filter((g) => g.items.length);
  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.place}>
          <h4 className="text-[15px] font-bold">
            {PLACE_TITLE[g.place]}
            {g.place === "profile" && <span className="ml-2 font-mono text-[13px] font-normal text-muted">{HOME}</span>}
          </h4>
          <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-card">
            {g.items.map((it) => {
              const c = describe(rules, it);
              return (
                <li key={it.id} className="flex items-start gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold">
                      {it.label ?? (c.found ? c.match.kind : it.path.split("\\").pop())}
                      {it.origin === "fake_laptop" && <Tag>FAKE-DEMO</Tag>}
                      {it.origin === "verify" && <Tag>found by verify</Tag>}
                      {it.origin === "added" && <Tag tone="accent">added by you</Tag>}
                    </div>
                    <code className="path mt-0.5 block break-all text-[13px] text-muted">{shortPath(it)}</code>
                    {it.envNames && it.envNames.length > 0 && (
                      <p className="mt-0.5 text-[13px] text-muted">Variable names: <span className="font-mono">{it.envNames.join(", ")}</span></p>
                    )}
                  </div>
                  {it.origin === "added" && (
                    <button type="button" onClick={() => onRemove(it.id)}
                      className="min-h-11 shrink-0 rounded px-2 text-[14px] text-link underline underline-offset-2 hover:bg-mist">
                      Remove<span className="sr-only"> {it.path}</span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="text-[14px] text-muted">
        The {IN_PROFILE} files marked FAKE-DEMO are the fake secrets from the video. The C:\dev .env is the file verify
        found readable from the spare room on the test machine; its contents were never read.
      </p>
    </div>
  );
}

// ---- adding a file ---------------------------------------------------------

function AddFile({ onAdd, existing }: { onAdd: (item: Item) => string | null; existing: Item[] }) {
  const id = useId();
  const [type, setType] = useState<AddType>("env");
  const [variantId, setVariantId] = useState("");
  const [fileName, setFileName] = useState(".env");
  const [where, setWhere] = useState<AddWhere>("c_dev");
  const [project, setProject] = useState("take-home");
  const [envRaw, setEnvRaw] = useState("STRIPE_SECRET_KEY");
  const [status, setStatus] = useState("");

  const vs = useMemo(() => variants(rules, type), [type]);
  const variant = vs.find((v) => v.id === variantId) ?? vs[0];
  const hasVariants = vs.length > 0;
  const whereOptions = WHERE.filter((w) => w.id !== "usual" || hasVariants);
  const effectiveWhere = !hasVariants && where === "usual" ? "desktop" : where;
  const path = buildPath(rules, { type, where: effectiveWhere, variant: hasVariants ? variant : undefined, fileName, project });
  const env = cleanEnvNames(envRaw);
  const needsProject = effectiveWhere === "project" || effectiveWhere === "c_dev";

  const pickType = (t: AddType) => {
    setType(t);
    setVariantId("");
    if (t === "env") setFileName(".env");
    if (t === "any") setFileName("");
    const nextHasVariants = variants(rules, t).length > 0;
    setWhere(nextHasVariants ? "usual" : t === "env" ? "c_dev" : "desktop");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasVariants && !cleanName(fileName)) return setStatus("Type a file name first.");
    if (existing.some((i) => i.path.toLowerCase() === path.toLowerCase())) return setStatus(`${path} is already on the fake laptop.`);
    const item: Item = { id: `added-${Date.now()}`, path, origin: "added",
      envNames: type === "env" || /^\.env/.test(cleanName(fileName)) ? env.names : undefined };
    const err = onAdd(item);
    setStatus(err ?? `Added ${path}. Run the code again to see what happens to it in each room.`);
  };

  const field = "mt-1 block min-h-11 w-full rounded-md border border-line bg-card px-3 text-[15px] text-ink focus:border-navy";
  return (
    <form onSubmit={submit} className="space-y-4" autoComplete="off" noValidate>
      <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <label className="block text-[15px] font-semibold">
          Kind of file
          <select className={field} value={type} onChange={(e) => pickType(e.target.value as AddType)}>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        {hasVariants ? (
          <label className="block text-[15px] font-semibold">
            Which one
            <select className={field} value={variant?.id} onChange={(e) => setVariantId(e.target.value)}>
              {vs.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>
        ) : (
          <label className="block text-[15px] font-semibold">
            File name
            <input className={`${field} font-mono`} value={fileName} spellCheck={false} maxLength={60}
              placeholder={type === "any" ? "for example notes.txt" : ".env"} onChange={(e) => setFileName(e.target.value)} />
          </label>
        )}
        <label className="block text-[15px] font-semibold sm:col-span-2">
          Where it lives
          <select className={field} value={effectiveWhere} onChange={(e) => setWhere(e.target.value as AddWhere)}>
            <optgroup label="Inside your user folder">
              {whereOptions.filter((w) => !w.outside).map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </optgroup>
            <optgroup label="Outside your user folder">
              {whereOptions.filter((w) => w.outside).map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </optgroup>
          </select>
        </label>
        {needsProject && (
          <label className="block text-[15px] font-semibold">
            Project folder name
            <input className={`${field} font-mono`} value={project} spellCheck={false} maxLength={60}
              onChange={(e) => setProject(e.target.value)} />
          </label>
        )}
        {(type === "env" || (type === "any" && /^\.env/.test(cleanName(fileName)))) && (
          <div className={needsProject ? "" : "sm:col-span-2"}>
            <label htmlFor={`${id}-env`} className="block text-[15px] font-semibold">Variable names (optional)</label>
            <input id={`${id}-env`} aria-describedby={`${id}-env-note`} className={`${field} font-mono`} value={envRaw}
              spellCheck={false} maxLength={300} placeholder="STRIPE_SECRET_KEY, DATABASE_URL"
              onChange={(e) => setEnvRaw(e.target.value)} />
            <p id={`${id}-env-note`} className="mt-1 text-[14px] text-muted">
              Spare Room never reads values, so this page doesn&apos;t ask for them.
              {env.droppedValues && <span className="block font-semibold text-ink">Only the names are kept; anything after = was dropped.</span>}
            </p>
          </div>
        )}
      </div>
      <p className="text-[14px]">
        Adds <code className="path break-all text-[13px]">{path}</code>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-outline">Add to the fake laptop</button>
        <p aria-live="polite" className="text-[14px] text-muted">{status}</p>
      </div>
    </form>
  );
}

// ---- stranger code ---------------------------------------------------------

function StrangerCode({ trapId, setTrapId }: { trapId: string; setTrapId: (id: string) => void }) {
  const trap = rules.traps.find((t) => t.id === trapId) ?? rules.traps[0];
  const [fileIx, setFileIx] = useState(() => Math.max(0, trap.files.findIndex((f) => f.path.endsWith(".json"))));
  const file = trap.files[fileIx] ?? trap.files[0];
  const tabId = useId();
  return (
    <div>
      <fieldset>
        <legend className="text-[15px] font-semibold">Sample stranger code, from the repo&apos;s traps folder</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {rules.traps.map((t) => (
            <label key={t.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[15px] ${
              t.id === trap.id ? "border-navy bg-accent-soft font-semibold" : "border-line bg-card"}`}>
              <input type="radio" name="trap" value={t.id} checked={t.id === trap.id} onChange={() => setTrapId(t.id)}
                className="accent-[var(--navy)]" />
              {t.trigger}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-[15px]"><span className="font-semibold">When it fires:</span> {trap.description}</p>
      <div className="mt-3 overflow-hidden rounded-md border border-line bg-card">
        <div role="tablist" aria-label={`Files in traps/${trap.folder}`} className="flex flex-wrap border-b border-line bg-mist">
          {trap.files.map((f, i) => (
            <button key={f.path} type="button" role="tab" id={`${tabId}-t${i}`} aria-selected={i === fileIx}
              aria-controls={`${tabId}-p`} onClick={() => setFileIx(i)}
              className={`min-h-11 px-3 font-mono text-[13px] ${i === fileIx ? "bg-card font-semibold text-ink" : "text-muted hover:text-ink"}`}>
              {f.path}
            </button>
          ))}
        </div>
        <pre id={`${tabId}-p`} role="tabpanel" aria-labelledby={`${tabId}-t${fileIx}`} tabIndex={0}
          className={`max-h-80 overflow-auto p-3 font-mono text-[13px] leading-5 ${file.path.endsWith(".md") ? "whitespace-pre-wrap" : ""}`}>
          {file.text}
        </pre>
      </div>
      <p className="mt-2 text-[14px] text-muted">
        The real files, unchanged:{" "}
        <a href={`${REPO_URL}/tree/master/traps/${trap.folder}`} rel="noreferrer">traps/{trap.folder} on GitHub</a>.
        Here it does not run; the page simulates the probe it calls.
      </p>
    </div>
  );
}

// ---- reports ---------------------------------------------------------------

function ProbeLine({ line, state }: { line: Line; state: "visible" | "blocked" | "unknown" }) {
  const word = state === "unknown" ? "?" : state;
  const color = state === "visible" ? "text-high" : state === "blocked" ? "text-ok" : "text-muted";
  return (
    <li className="py-1.5">
      <div className="flex gap-3 font-mono text-[13px]">
        <span className={`w-16 shrink-0 font-semibold ${color}`}>{word}</span>
        <span className="min-w-0 flex-1 break-all">{line.item.path}</span>
      </div>
      <div className="ml-[76px] mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px]">
        <SeverityTag level={line.match.severity} /> <span>{line.match.kind}</span>
        {line.item.origin === "added" && <Tag tone="accent">added by you</Tag>}
      </div>
    </li>
  );
}

function Report({ rep, trap, stale }: { rep: RoomReport; trap: Rules["traps"][number]; stale: boolean }) {
  const n = rep.visible.length;
  const spare = rep.room === "spare";
  const outside = rep.visible.length - rep.inProfile.visible;
  const headline = spare
    ? n ? `${n === 1 ? "thing" : "things"} stranger code could take from here.`
      : `Nothing found that stranger code could take from here, in the ${rep.checked} places checked.`
    : n ? `${n === 1 ? "thing" : "things"} stranger code could reach.`
      : `Nothing found in the ${rep.checked} places checked.`;
  return (
    <section aria-label={`Report: ${ROOM_TITLE[rep.room]}`}
      className={`rounded-lg border border-line bg-card p-4 sm:p-5 ${stale ? "opacity-50" : ""}`}>
      <h4 className="text-lg font-bold">{ROOM_TITLE[rep.room]}</h4>
      <p className="mt-3 flex items-baseline gap-3">
        <span className={`text-5xl font-semibold leading-none tabular-nums ${n ? "text-high" : "text-ok"}`}>{n}</span>
        <span className="text-[15px] font-semibold">{headline}</span>
      </p>
      <p className="mt-2 text-[15px]">
        {rep.inProfile.visible} of {rep.inProfile.total} in your user folder
        {spare && rep.inProfile.blocked === rep.inProfile.total && rep.inProfile.total > 0 ? ": Windows denied access to every one" : ""}
        {outside > 0 ? `; ${outside} outside it` : ""}.
      </p>

      <div className="mt-4 rounded-md border border-line bg-[#f3f4f0] px-3 py-2">
        <p className="font-mono text-[13px]">Probe {trap.id} ({probeTrigger(trap)}) as {ROOM_LABEL[rep.room]}:</p>
        <p className="whitespace-pre font-mono text-[13px]">{`  visible: ${rep.visible.length}   blocked: ${rep.blocked.length}`}</p>
        <ul className="mt-1 divide-y divide-line/70">
          {rep.visible.map((l) => <ProbeLine key={l.item.id} line={l} state="visible" />)}
          {rep.blocked.map((l) => <ProbeLine key={l.item.id} line={l} state="blocked" />)}
        </ul>
      </div>

      {spare && rep.shared.length > 0 && (
        <div className="mt-4">
          <h5 className="text-[15px] font-bold">Readable by every account:</h5>
          <ul className="mt-1 space-y-2 text-[14px]">
            {rep.shared.map((l) => (
              <li key={l.item.id}>
                <code className="path break-all text-[13px]">{l.item.path}</code> ({l.match.kind})
                <span className="mt-0.5 block">
                  A separate account cannot protect it. Move it into your own user folder, where the spare room cannot
                  read it.
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rep.unknown.length > 0 && (
        <div className="mt-4">
          <h5 className="text-[15px] font-bold">The real tool would check this:</h5>
          <ul className="mt-1 space-y-2 text-[14px]">
            {rep.unknown.map((l) => (
              <li key={l.item.id}>
                <code className="path break-all text-[13px]">{l.item.path}</code> ({l.match.kind})
                <span className="mt-0.5 block text-muted">{REACH_EVIDENCE[placeOf(rules, l.item.path)]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {rep.notLooked.length > 0 && (
        <div className="mt-4">
          <h5 className="text-[15px] font-bold">Spare Room doesn&apos;t look for this kind of file:</h5>
          <ul className="mt-1 space-y-2 text-[14px]">
            {rep.notLooked.map(({ item, hint }) => (
              <li key={item.id}>
                <code className="path break-all text-[13px]">{item.path}</code>
                {hint && <span className="mt-0.5 block text-muted">{hint}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ---- the playground --------------------------------------------------------

export default function Playground() {
  const [added, setAdded] = useState<Item[]>([]);
  const [trapId, setTrapId] = useState(rules.traps[0].id);
  const [reports, setReports] = useState<Partial<Record<Room, RoomReport>>>({});
  const [ranWith, setRanWith] = useState<Partial<Record<Room, string>>>({});
  const [announce, setAnnounce] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const items = useMemo(() => [...BASE, ...added], [added]);
  const trap = rules.traps.find((t) => t.id === trapId) ?? rules.traps[0];
  const stateKey = `${trapId}|${added.map((a) => a.id).join(",")}`;

  const run = (room: Room) => {
    const rep = runProbe(rules, items, room);
    setReports((r) => ({ ...r, [room]: rep }));
    setRanWith((r) => ({ ...r, [room]: stateKey }));
    setAnnounce(`${ROOM_TITLE[room]}: ${rep.visible.length} visible, ${rep.blocked.length} blocked.`);
  };
  const reset = () => {
    setAdded([]);
    setTrapId(rules.traps[0].id);
    setReports({});
    setRanWith({});
    setResetKey((k) => k + 1);
    setAnnounce("Everything is back to the fake laptop from the video.");
  };
  const ran = (Object.keys(reports) as Room[]);
  const stale = (room: Room) => ranWith[room] !== undefined && ranWith[room] !== stateKey;
  const anyStale = ran.some(stale);
  const defaultRun = added.length === 0;

  return (
    <div className="space-y-8">
      <p className="rounded-md border-l-4 border-accent bg-accent-soft px-4 py-3 text-[15px] sm:text-base">
        This runs in your browser and simulates Spare Room&apos;s rules on a fake laptop. The real tool checks real
        Windows permissions. <a href="#video">Watch the video</a> for a real run.
      </p>

      <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-8">
          <div>
            <h3 className="mb-3 text-xl font-bold">The fake laptop</h3>
            <Laptop items={items} onRemove={(id) => setAdded((a) => a.filter((i) => i.id !== id))} />
          </div>
          <div className="rounded-lg border border-line bg-mist p-4 sm:p-5">
            <h3 className="mb-3 text-xl font-bold">Add a file</h3>
            <AddFile key={resetKey} existing={items} onAdd={(item) => { setAdded((a) => [...a, item]); return null; }} />
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-xl font-bold">Stranger code</h3>
          <StrangerCode key={`${trapId}-${resetKey}`} trapId={trapId} setTrapId={setTrapId} />
        </div>
      </div>

      <div id="try-run" className="scroll-mt-24">
        <h3 className="mb-2 text-xl font-bold">Run it</h3>
        <p className="mb-4 max-w-[720px] text-[15px]">
          The code calls Spare Room&apos;s probe, which only checks whether each listed path exists and can be read. It
          never opens a file and never uses the network.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-navy" onClick={() => run("yours")}>Run in my account</button>
          <button type="button" className="btn btn-navy" onClick={() => run("spare")}>Run in the spare room</button>
          <button type="button" className="btn btn-outline" onClick={reset}>Reset</button>
        </div>
        {anyStale && (
          <p className="mt-4 font-semibold" role="status">The fake laptop changed. Run the code again to see the new file.</p>
        )}
        <div className="mt-5 grid gap-5 md:grid-cols-2 [&>*]:min-w-0">
          {(["yours", "spare"] as Room[]).map((room) => reports[room] ? (
            <Report key={room} rep={reports[room]!} trap={trap} stale={stale(room)} />
          ) : (
            <div key={room} className="rounded-lg border border-dashed border-line p-5 text-[15px] text-muted">
              <span className="font-bold text-ink">{ROOM_TITLE[room]}.</span>{" "}
              {room === "yours" ? "Press Run in my account." : "Press Run in the spare room."}
            </div>
          ))}
        </div>
        {ran.length > 0 && !anyStale && (
          <p className="mt-4 text-[15px] font-semibold">
            {defaultRun ? "Matches the real tool's recorded run."
              : `The ${IN_PROFILE} files from the video and verify's .env match the real tool's recorded run. The files you added follow the tool's own rules.`}
          </p>
        )}
      </div>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  );
}

