"use client";

// "Try it here, no download": Spare Room's rules, simulated on the fake laptop.
// Everything stays in this component's state: no network, no storage, nothing
// typed here leaves the page. The rules come from data/rules.json, generated
// from the Python source; see lib/playground.ts for what is and is not simulated.

import { useId, useMemo, useRef, useState } from "react";
import rulesJson from "@/data/rules.json";
import { SeverityTag } from "@/components/ui";
import { acct, REPO_URL, scan, SHORT_NAMES } from "@/lib/data";
import {
  buildPath, cleanEnvNames, cleanName, defaultItems, describe, placeOf, REACH_EVIDENCE, runProbe, variants,
  verifyFindings, type AddType, type AddWhere, type Item, type Line, type Match, type Room, type RoomReport, type Rules,
} from "@/lib/playground";

const rules = rulesJson as unknown as Rules;
const HOME = `C:\\Users\\${rules.fake_laptop.home_user}`;
const BASE: Item[] = defaultItems(rules, SHORT_NAMES, scan.findings as (Match & { path: string })[]);
const VERIFY = verifyFindings(rules, acct.verify.readable_env_outside_profiles);
const MOVE_IT = "A separate account cannot protect it. Move it into your own user folder, where the spare room cannot read it.";

const ROOM_TITLE: Record<Room, string> = { yours: "Your account", spare: "The spare room" };
const ROOM_LABEL: Record<Room, string> = { yours: "normal", spare: "interview" }; // the recorded runs' labels
const PREVIEW_LINES = 3;

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

function Tag({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "accent" }) {
  return (
    <span className={`inline-block rounded-[3px] border px-1.5 py-px font-mono text-[13px] font-medium ${
      tone === "accent" ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-mist text-muted"}`}>
      {children}
    </span>
  );
}

// ---- stranger code ---------------------------------------------------------

function FileTabs({ trap }: { trap: Rules["traps"][number] }) {
  const [ix, setIx] = useState(() => Math.max(0, trap.files.findIndex((f) => f.path.endsWith(".json"))));
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const file = trap.files[ix] ?? trap.files[0];
  const onKey = (e: React.KeyboardEvent) => {
    const n = trap.files.length;
    const next = { ArrowRight: (ix + 1) % n, ArrowLeft: (ix - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setIx(next);
    tabs.current[next]?.focus();
  };
  return (
    <div className="overflow-hidden rounded-md border border-line bg-card">
      <div role="tablist" aria-label={`Files in traps/${trap.folder}`} onKeyDown={onKey}
        className="flex flex-wrap border-b border-line bg-mist">
        {trap.files.map((f, i) => (
          <button key={f.path} ref={(el) => { tabs.current[i] = el; }} type="button" role="tab" id={`${id}-t${i}`}
            aria-selected={i === ix} aria-controls={`${id}-p`} tabIndex={i === ix ? 0 : -1} onClick={() => setIx(i)}
            className={`min-h-11 px-3 font-mono text-[13px] ${i === ix ? "bg-card font-semibold text-ink" : "text-muted hover:text-ink"}`}>
            {f.path}
          </button>
        ))}
      </div>
      <pre id={`${id}-p`} role="tabpanel" aria-labelledby={`${id}-t${ix}`} tabIndex={0}
        className={`max-h-44 overflow-auto p-3 font-mono text-[13px] leading-5 sm:max-h-72 lg:max-h-[232px] ${file.path.endsWith(".md") ? "whitespace-pre-wrap" : ""}`}>
        {file.text}
      </pre>
    </div>
  );
}

function StrangerCode({ trap, setTrapId }: { trap: Rules["traps"][number]; setTrapId: (id: string) => void }) {
  return (
    <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div>
        <h3 className="mb-2 text-xl font-bold">Stranger code</h3>
        {rules.traps.length === 1 ? (
          <p className="text-[15px]">
            <span className="font-semibold">{trap.trigger}</span>, the sample in the repo&apos;s traps folder.
          </p>
        ) : (
          <fieldset>
            <legend className="text-[15px] font-semibold">Sample stranger code, from the repo&apos;s traps folder</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {rules.traps.map((t) => (
                <label key={t.id} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-[15px] ${
                  t.id === trap.id ? "border-navy bg-accent-soft font-semibold" : "border-line bg-card"}`}>
                  <input type="radio" name="trap" value={t.id} checked={t.id === trap.id} onChange={() => setTrapId(t.id)} />
                  {t.trigger}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <p className="mt-2 text-[15px]"><span className="font-semibold">When it fires:</span> {trap.description}</p>
        <p className="mt-2 text-[14px] text-muted">
          These are the real files, unchanged:{" "}
          <a href={`${REPO_URL}/tree/master/traps/${trap.folder}`} rel="noreferrer">traps/{trap.folder} on GitHub</a>.
          Here nothing runs; the page simulates the probe it calls.
        </p>
      </div>
      <FileTabs key={trap.id} trap={trap} />
    </div>
  );
}

// ---- reports ---------------------------------------------------------------

function StateWord({ state }: { state: "visible" | "blocked" | "readable" }) {
  return <span className={`w-16 shrink-0 font-semibold ${state === "blocked" ? "text-ok" : "text-high"}`}>{state}</span>;
}

function ProbeLine({ line, state }: { line: Line; state: "visible" | "blocked" }) {
  return (
    <li className="py-1.5">
      <div className="flex gap-3 font-mono text-[13px]">
        <StateWord state={state} />
        <span className="min-w-0 flex-1 break-all">{line.item.path}</span>
      </div>
      <div className="ml-[76px] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
        <SeverityTag level={line.match.severity} /> <span>{line.match.kind}</span>
        {line.item.origin === "added" && <Tag tone="accent">added by you</Tag>}
      </div>
    </li>
  );
}

function SubList({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h5 className="text-[15px] font-bold">{title}</h5>
      <ul className="mt-1 space-y-2 text-[14px]">{children}</ul>
    </div>
  );
}

function Report({ rep, trap, stale }: { rep: RoomReport; trap: Rules["traps"][number]; stale: boolean }) {
  const [all, setAll] = useState(false);
  const listId = useId();
  const n = rep.visible.length;
  const spare = rep.room === "spare";
  const outside = rep.visible.length - rep.inProfile.visible;
  const headline = spare
    ? n ? `${n === 1 ? "thing" : "things"} stranger code could take from here.`
      : `Nothing found that stranger code could take from here, in the ${rep.checked} places checked.`
    : n ? `${n === 1 ? "thing" : "things"} stranger code could reach.`
      : `Nothing found in the ${rep.checked} places checked.`;
  // The probe prints visible, then blocked. Files a judge added are shown first
  // so the preview shows them; the recorded files keep their recorded order.
  const lines = [...rep.visible.map((l) => ({ l, s: "visible" as const })), ...rep.blocked.map((l) => ({ l, s: "blocked" as const }))]
    .sort((a, b) => Number(b.l.item.origin === "added") - Number(a.l.item.origin === "added"));
  const shown = all ? lines : lines.slice(0, PREVIEW_LINES);

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
        {spare && rep.inProfile.total > 0 && rep.inProfile.blocked === rep.inProfile.total ? ": Windows denied access to every one" : ""}
        {outside > 0 ? `; ${outside} outside it` : ""}.
      </p>

      <div className="mt-4 rounded-md border border-line bg-[#f3f4f0] px-3 py-2">
        <p className="font-mono text-[13px]">Probe {trap.id} ({probeTrigger(trap)}) as {ROOM_LABEL[rep.room]}:</p>
        <p className="whitespace-pre font-mono text-[13px]">{`  visible: ${rep.visible.length}   blocked: ${rep.blocked.length}`}</p>
        <ul id={listId} className="mt-1 divide-y divide-line/70">
          {shown.map(({ l, s }) => <ProbeLine key={l.item.id} line={l} state={s} />)}
        </ul>
        {lines.length > PREVIEW_LINES && (
          <button type="button" aria-expanded={all} aria-controls={listId} onClick={() => setAll((a) => !a)}
            className="mt-1 min-h-11 text-[14px] font-semibold text-link underline underline-offset-2">
            {all ? "Show the first 3" : `Show all ${lines.length}`}
          </button>
        )}
      </div>

      {rep.unlisted.length > 0 && (
        <SubList title={spare
          ? "The spare room can't open anything in your user folder, including files the scan doesn't know about."
          : "Stranger code can read this too. Spare Room's scan doesn't list this kind of file."}>
          {rep.unlisted.map(({ item, hint, reach }) => (
            <li key={item.id}>
              <div className="flex gap-3 font-mono text-[13px]">
                <StateWord state={reach === "blocked" ? "blocked" : "readable"} />
                <span className="min-w-0 flex-1 break-all">{item.path}</span>
              </div>
              {hint && !spare && <span className="ml-[76px] mt-0.5 block text-muted">{hint}</span>}
            </li>
          ))}
        </SubList>
      )}

      {spare && rep.shared.length > 0 && (
        <SubList title="Readable by every account:">
          {rep.shared.map((l) => (
            <li key={l.item.id}>
              <code className="path break-all text-[13px]">{l.item.path}</code> ({l.match.kind})
              <span className="mt-0.5 block">{MOVE_IT}</span>
            </li>
          ))}
        </SubList>
      )}

      {rep.unknown.length > 0 && (
        <SubList title="The real tool would check this:">
          {rep.unknown.map((l) => (
            <li key={l.item.id}>
              <code className="path break-all text-[13px]">{l.item.path}</code> ({l.match.kind})
              <span className="mt-0.5 block text-muted">{REACH_EVIDENCE[placeOf(rules, l.item.path)]}</span>
            </li>
          ))}
        </SubList>
      )}

      {rep.notLooked.length > 0 && (
        <SubList title="Spare Room doesn't look for this kind of file:">
          {rep.notLooked.map(({ item, hint }) => (
            <li key={item.id}>
              <code className="path break-all text-[13px]">{item.path}</code>
              {hint && <span className="mt-0.5 block text-muted">{hint}</span>}
            </li>
          ))}
        </SubList>
      )}
    </section>
  );
}

/** verify's own finding, recorded inside the spare room. Kept out of the probe's numbers. */
function VerifyBox() {
  return (
    <section aria-label="Also found by verify" className="rounded-lg border-2 border-accent bg-accent-soft p-4 sm:p-5">
      <h4 className="text-[16px] font-bold">
        Also found by verify, run inside the spare room: {VERIFY.length} {VERIFY.length === 1 ? "file" : "files"} every
        account can read
      </h4>
      <ul className="mt-2 space-y-2 text-[15px]">
        {VERIFY.map((l) => (
          <li key={l.item.id}>
            <code className="path break-all text-[13px]">{l.item.path}</code> ({l.match.kind})
            <span className="mt-0.5 block">{MOVE_IT}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---- the fake laptop -------------------------------------------------------

function Laptop({ added, onRemove }: { added: Item[]; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  return (
    <div>
      <h3 className="mb-2 text-xl font-bold">The fake laptop</h3>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="text-[15px]">
          <span className="font-semibold">{BASE.length} fake secrets in <span className="font-mono">{HOME}</span></span>
          <span className="text-muted">, the same ones as in the video, each marked FAKE-DEMO.</span>
        </p>
        <button type="button" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}
          className="min-h-11 text-[15px] font-semibold text-link underline underline-offset-2">
          {open ? "Hide the list" : "Show the list"}
        </button>
      </div>
      <ul id={listId} hidden={!open} className="mt-2 grid gap-x-6 rounded-md border border-line bg-card px-3 py-1 sm:grid-cols-2">
        {BASE.map((it) => (
          <li key={it.id} className="border-b border-line py-2 last:border-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-0">
            <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">{it.label}<Tag>FAKE-DEMO</Tag></div>
            <code className="path mt-0.5 block break-all text-[13px] text-muted">{it.path.slice(HOME.length + 1)}</code>
          </li>
        ))}
      </ul>
      {added.length > 0 && (
        <div className="mt-4">
          <h4 className="text-[15px] font-bold">Files you added</h4>
          <ul className="mt-2 divide-y divide-line rounded-md border border-line bg-card">
            {added.map((it) => {
              const c = describe(rules, it);
              return (
                <li key={it.id} className="flex items-start gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                      {c.found ? c.match.kind : it.path.split("\\").pop()}<Tag tone="accent">added by you</Tag>
                    </div>
                    <code className="path mt-0.5 block break-all text-[13px] text-muted">{it.path}</code>
                    {it.envNames && it.envNames.length > 0 && (
                      <p className="mt-0.5 text-[13px] text-muted">Variable names: <span className="font-mono">{it.envNames.join(", ")}</span></p>
                    )}
                  </div>
                  <button type="button" onClick={() => onRemove(it.id)}
                    className="min-h-11 shrink-0 rounded px-2 text-[14px] text-link underline underline-offset-2 hover:bg-mist">
                    Remove<span className="sr-only"> {it.path}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---- adding a file ---------------------------------------------------------

function AddFile({ onAdd, existing }: { onAdd: (item: Item) => void; existing: Item[] }) {
  const id = useId();
  const [type, setTypeRaw] = useState<AddType>("env");
  const [variantId, setVariantId] = useState("");
  const [fileName, setFileName] = useState(".env");
  const [where, setWhere] = useState<AddWhere>("c_dev");
  const [project, setProject] = useState("take-home");
  const [envRaw, setEnvRaw] = useState("STRIPE_SECRET_KEY");
  const [status, setStatus] = useState("");
  /** Any change to a field clears the last status message. */
  const edit = <T,>(set: (v: T) => void) => (v: T) => { setStatus(""); set(v); };

  const vs = useMemo(() => variants(rules, type), [type]);
  const variant = vs.find((v) => v.id === variantId) ?? vs[0];
  const hasVariants = vs.length > 0;
  const whereOptions = WHERE.filter((w) => w.id !== "usual" || hasVariants);
  const effectiveWhere = !hasVariants && where === "usual" ? "desktop" : where;
  const nameMissing = !hasVariants && !cleanName(fileName);
  const path = buildPath(rules, { type, where: effectiveWhere, variant: hasVariants ? variant : undefined, fileName, project });
  const env = cleanEnvNames(envRaw);
  const needsProject = effectiveWhere === "project" || effectiveWhere === "c_dev";
  const isEnv = type === "env" || (type === "any" && /^\.env/.test(cleanName(fileName)));

  const setType = (t: AddType) => {
    setStatus("");
    setTypeRaw(t);
    setVariantId("");
    if (t === "env") setFileName(".env");
    if (t === "any") setFileName("");
    setWhere(variants(rules, t).length > 0 ? "usual" : t === "env" ? "c_dev" : "documents");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameMissing) return setStatus("Type a file name first.");
    if (existing.some((i) => i.path.toLowerCase() === path.toLowerCase())) return setStatus(`${path} is already on the fake laptop.`);
    onAdd({ id: `added-${Date.now()}`, path, origin: "added", envNames: isEnv ? env.names : undefined });
    setStatus(`Added ${path}. Run the code again to see what happens to it in each room.`);
  };

  const field = "mt-1 block min-h-11 w-full rounded-md border border-line bg-card px-3 text-[15px] text-ink focus:border-navy";
  return (
    <form onSubmit={submit} className="space-y-4" autoComplete="off" noValidate>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        <div>
          <label htmlFor={`${id}-kind-of-file`} className="block text-[15px] font-semibold">Kind of file</label>
          <select id={`${id}-kind-of-file`} className={field} value={type} onChange={(e) => setType(e.target.value as AddType)}>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        {hasVariants ? (
          <div>
            <label htmlFor={`${id}-which-one`} className="block text-[15px] font-semibold">Which one</label>
            <select id={`${id}-which-one`} className={field} value={variant?.id} onChange={(e) => edit(setVariantId)(e.target.value)}>
              {vs.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
        ) : (
          <div>
            <label htmlFor={`${id}-file-name`} className="block text-[15px] font-semibold">File name</label>
            <input id={`${id}-file-name`} className={`${field} font-mono`} value={fileName} spellCheck={false} maxLength={60}
              placeholder={type === "any" ? "for example passwords.txt" : ".env"} onChange={(e) => edit(setFileName)(e.target.value)} />
          </div>
        )}
        <div>
          <label htmlFor={`${id}-where-it-lives`} className="block text-[15px] font-semibold">Where it lives</label>
          <select id={`${id}-where-it-lives`} className={field} value={effectiveWhere} onChange={(e) => edit(setWhere)(e.target.value as AddWhere)}>
            <optgroup label="Inside your user folder">
              {whereOptions.filter((w) => !w.outside).map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </optgroup>
            <optgroup label="Outside your user folder">
              {whereOptions.filter((w) => w.outside).map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
            </optgroup>
          </select>
        </div>
        {needsProject && (
          <div>
            <label htmlFor={`${id}-project-folder-name`} className="block text-[15px] font-semibold">Project folder name</label>
            <input id={`${id}-project-folder-name`} className={`${field} font-mono`} value={project} spellCheck={false} maxLength={60}
              onChange={(e) => edit(setProject)(e.target.value)} />
          </div>
        )}
        {isEnv && (
          <div className={needsProject ? "sm:col-span-1 lg:col-span-2" : "sm:col-span-2 lg:col-span-3"}>
            <label htmlFor={`${id}-env`} className="block text-[15px] font-semibold">Variable names (optional)</label>
            <input id={`${id}-env`} aria-describedby={`${id}-env-note`} className={`${field} font-mono`} value={envRaw}
              spellCheck={false} maxLength={300} placeholder="STRIPE_SECRET_KEY, DATABASE_URL"
              onChange={(e) => edit(setEnvRaw)(e.target.value)} />
            <p id={`${id}-env-note`} className="mt-1 text-[14px] text-muted">
              Spare Room never reads values, so this page doesn&apos;t ask for them. Separate names with commas.
              {env.droppedValues && <span className="block font-semibold text-ink">Only the names are kept: anything after = was dropped.</span>}
              {env.droppedEntries && <span className="block font-semibold text-ink">Entries that are not a single variable name were dropped.</span>}
            </p>
          </div>
        )}
      </div>
      <p className="text-[14px]">
        {nameMissing ? <span className="text-muted">Type a file name to see where it goes.</span>
          : <>Adds <code className="path break-all text-[13px]">{path}</code></>}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-outline">Add to the fake laptop</button>
        <p aria-live="polite" className="text-[14px] text-muted">{status}</p>
      </div>
    </form>
  );
}

// ---- the playground --------------------------------------------------------

export default function Playground() {
  const [added, setAdded] = useState<Item[]>([]);
  const [trapId, setTrapId] = useState(rules.traps[0].id);
  const [reports, setReports] = useState<Partial<Record<Room, RoomReport>>>({});
  const [ranWith, setRanWith] = useState<Partial<Record<Room, string>>>({});
  const [runs, setRuns] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const items = useMemo(() => [...BASE, ...added], [added]);
  const trap = rules.traps.find((t) => t.id === trapId) ?? rules.traps[0];
  const stateKey = `${trapId}|${added.map((a) => a.id).join(",")}`;

  const run = (room: Room) => {
    const rep = runProbe(rules, items, room);
    setReports((r) => ({ ...r, [room]: rep }));
    setRanWith((r) => ({ ...r, [room]: stateKey }));
    setRuns((n) => n + 1);
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
  const ran = Object.keys(reports) as Room[];
  const stale = (room: Room) => ranWith[room] !== undefined && ranWith[room] !== stateKey;
  const anyStale = ran.some(stale);

  return (
    <div className="space-y-10">
      <p className="rounded-md border-l-4 border-accent bg-accent-soft px-4 py-3 text-[15px] sm:text-base">
        This runs in your browser and simulates Spare Room&apos;s rules on a fake laptop. The real tool checks real
        Windows permissions. <a href="#video">Watch the video</a> for a real run.
      </p>

      <StrangerCode trap={trap} setTrapId={setTrapId} />

      <div id="try-run" className="scroll-mt-24">
        <h3 className="mb-1 text-xl font-bold">Run it</h3>
        <p className="mb-3 max-w-[760px] text-[15px]">
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
        <div className="mt-5 grid items-start gap-5 md:grid-cols-2 [&>*]:min-w-0">
          {(["yours", "spare"] as Room[]).map((room) => (
            <div key={room} className="space-y-4">
              {reports[room] ? (
                <Report key={`${room}-${runs}`} rep={reports[room]!} trap={trap} stale={stale(room)} />
              ) : (
                <div className="rounded-lg border border-dashed border-line p-5 text-[15px] text-muted">
                  <span className="font-bold text-ink">{ROOM_TITLE[room]}.</span>{" "}
                  {room === "yours" ? "Press Run in my account." : "Press Run in the spare room."}
                </div>
              )}
              {room === "spare" && reports.spare && <VerifyBox />}
            </div>
          ))}
        </div>
        {ran.length > 0 && !anyStale && (
          <p className="mt-4 text-[15px] font-semibold">
            {added.length === 0 ? "Matches the real tool's recorded run."
              : `The ${BASE.length} files from the video match the real tool's recorded run. The files you added follow the tool's own rules.`}
          </p>
        )}
      </div>

      <Laptop added={added} onRemove={(id) => setAdded((a) => a.filter((i) => i.id !== id))} />

      <div className="rounded-lg border border-line bg-mist p-4 sm:p-6">
        <h3 className="mb-3 text-xl font-bold">Add a file</h3>
        <AddFile key={resetKey} existing={items} onAdd={(item) => setAdded((a) => [...a, item])} />
      </div>
      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  );
}
