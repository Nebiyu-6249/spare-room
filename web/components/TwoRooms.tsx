"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { acct, cellsFor, KIND_LABELS, KIND_OF, setupLines, twin, winPath, type Kind } from "@/lib/data";

// ---- recorded data ---------------------------------------------------------

const SECRETS = twin.matrix.secrets.map((s) => ({ ...s, kind: KIND_OF[s.category] as Kind, win: winPath(s.path) }));
const YOURS = cellsFor("normal");
const SPARE = cellsFor("interview");
const TOTAL = SECRETS.length;
const YOURS_REACHED = YOURS.filter((c) => c === "visible").length;
const SPARE_REACHED = SPARE.filter((c) => c === "visible").length;

// The recorded setup output, hard-wrapped at the terminal's width, joined back
// into its sentences so the panel does not wrap it twice. No words change.
const SETUP_UNITS = setupLines.reduce<string[]>((acc, line, i) => {
  const open = i > 0 && !/[.:]\s*\S?$/.test(setupLines[i - 1]) && !/\[y\/N\]/.test(setupLines[i - 1]);
  if (open) acc[acc.length - 1] += " " + line;
  else acc.push(line);
  return acc;
}, []);

const STEP_LABELS = [
  "1. Open the test assignment in your room",
  "2. Create the spare room",
  "3. Open it again in the spare room",
];
const LINE_COUNTS = [TOTAL, SETUP_UNITS.length, TOTAL];
const TICK_MS = [170, 320, 170];

// ---- floor plan ------------------------------------------------------------

type IconState = "idle" | "reached" | "blocked";

function Icon({ kind }: { kind: Kind }) {
  switch (kind) {
    case "keys":
      return <><circle cx="8" cy="12" r="4" /><path d="M12 12h9M18 12v3M15 12v2" /></>;
    case "cloud":
      return <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.2 9.5 4.5 4.5 0 0 0 7 18z" />;
    case "wallets":
      return <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h14" /><circle cx="16.5" cy="14" r="1" /></>;
    case "browser":
      return <><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="M3 9h18" /><path d="M6 7h.01M8.5 7h.01" /></>;
    case "ai":
      return <><path d="M4 6h16v10H10l-4 3v-3H4z" /><path d="M9 11h.01M12 11h.01M15 11h.01" /></>;
    case "shell":
      return <><rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="M7 10l3 2-3 2M12 15h5" /></>;
    case "env":
      return <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 15h6" /></>;
  }
}

// Where each kind sits in "Your room" (viewBox 380 x 300): label position and box.
const LAYOUT: Record<Kind, { x: number; y: number }> = {
  keys: { x: 24, y: 64 }, cloud: { x: 198, y: 64 },
  wallets: { x: 24, y: 144 }, browser: { x: 198, y: 144 }, ai: { x: 276, y: 144 },
  shell: { x: 24, y: 224 }, env: { x: 150, y: 224 },
};
const SLOT = 40;

const STROKE: Record<IconState, string> = { idle: "var(--muted)", reached: "var(--high)", blocked: "var(--ok)" };
const HALO: Record<IconState, string> = { idle: "transparent", reached: "#f7e4e7", blocked: "#e3efe6" };

function Walls({ title }: { title: string }) {
  return (
    <>
      {/* walls with a door gap in the bottom wall, and the door leaf swung in */}
      <path d="M262 286H8V8h364v278h-50" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M262 286V232" stroke="var(--ink)" strokeWidth="2" />
      <path d="M262 232A54 54 0 0 1 316 286" fill="none" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="24" y="38" fontSize="16" fontWeight="600" fill="var(--ink)">{title}</text>
    </>
  );
}

function YourRoom({ states }: { states: IconState[] }) {
  const byKind = (Object.keys(LAYOUT) as Kind[]).map((k) => ({
    kind: k,
    items: SECRETS.map((s, i) => ({ ...s, i })).filter((s) => s.kind === k),
  }));
  const reached = states.filter((s) => s === "reached").length;
  return (
    <svg viewBox="0 0 380 300" className="block h-auto w-full" role="img"
      aria-label={`Your room: ${TOTAL} fake secrets in ${byKind.length} kinds. ${reached} shown as reachable.`}>
      <Walls title="Your room" />
      {byKind.map(({ kind, items }) => {
        const { x, y } = LAYOUT[kind];
        const w = items.length * SLOT + 12;
        return (
          <g key={kind}>
            <text x={x} y={y} fontSize="14" fill="var(--muted)">{KIND_LABELS[kind]}</text>
            <rect x={x} y={y + 8} width={w} height={46} rx="5" fill="var(--card)" stroke="var(--line)" />
            {items.map((s, j) => {
              const st = states[s.i];
              const cx = x + 6 + j * SLOT + SLOT / 2;
              const cy = y + 31;
              return (
                <g key={s.path}>
                  <circle cx={cx} cy={cy} r="17" fill={HALO[st]} />
                  <g transform={`translate(${cx - 12} ${cy - 12})`} fill="none" stroke={STROKE[st]}
                    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <Icon kind={kind} />
                  </g>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function SpareRoom({ ready, checked }: { ready: boolean; checked: boolean }) {
  const line = checked ? `Empty. ${SPARE_REACHED} of ${TOTAL} reachable from here.`
    : ready ? "Empty. Nothing to take." : "Not created yet";
  return (
    <svg viewBox="0 0 380 300" className="block h-auto w-full" role="img" aria-label={`The spare room: ${line}`}>
      <Walls title="The spare room" />
      <text x="190" y="158" textAnchor="middle" fontSize="15" fill={checked ? "var(--ok)" : "var(--muted)"}
        fontWeight={checked ? 600 : 400}>
        {line}
      </text>
    </svg>
  );
}

// ---- recorded output panels -----------------------------------------------

function Panel({ title, children, empty }: { title: string; children?: React.ReactNode; empty: string }) {
  return (
    <div className="mt-3 rounded-md border border-line bg-[#f3f4f0] font-mono text-[13px] leading-6">
      <div className="border-b border-line px-3 py-1.5 font-sans text-[13px] text-muted">{title}</div>
      <div className="min-h-24 px-3 py-2">{children ?? <span className="text-muted">{empty}</span>}</div>
    </div>
  );
}

/** One replayed line: the state word in its own column, the path wrapping beside it. */
function Line({ state, path }: { state: string; path: string }) {
  const reachable = state === "visible";
  return (
    <div className="flex gap-3">
      <span className={`w-20 shrink-0 font-semibold ${reachable ? "text-high" : "text-ok"}`}>
        {reachable ? "reachable" : state === "blocked" ? "blocked" : "absent"}
      </span>
      <span className="min-w-0 flex-1 break-all">{path}</span>
    </div>
  );
}

// ---- the replay ------------------------------------------------------------

export default function TwoRooms() {
  const [shown, setShown] = useState<number[]>([0, 0, 0]);
  const [done, setDone] = useState(0); // steps completed, 0..3
  const [running, setRunning] = useState<number | null>(null);
  const [announce, setAnnounce] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const reduced = useRef(false);

  const summary = (step: number) =>
    step === 0 ? `${YOURS_REACHED} of ${TOTAL} fake secrets reachable from your account.`
      : step === 1 ? `Spare room created in ${acct.setup_wall_s} seconds.`
        : `${SPARE_REACHED} of ${TOTAL} reachable from the spare room. All blocked.`;

  const finish = useCallback((step: number) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setShown((s) => s.map((v, i) => (i === step ? LINE_COUNTS[i] : v)));
    setDone(step + 1);
    setRunning(null);
    setAnnounce(summary(step));
  }, []);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) {
      setShown([...LINE_COUNTS]);
      setDone(3);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, []);

  const run = (step: number) => {
    if (timer.current) clearInterval(timer.current);
    setShown((s) => s.map((v, i) => (i < step ? LINE_COUNTS[i] : i === step ? 0 : 0)));
    setDone(step);
    if (reduced.current) return finish(step);
    setRunning(step);
    setAnnounce("");
    let n = 0;
    timer.current = setInterval(() => {
      n += 1;
      setShown((s) => s.map((v, i) => (i === step ? n : v)));
      if (n >= LINE_COUNTS[step]) finish(step);
    }, TICK_MS[step]);
  };

  const reset = () => {
    if (timer.current) clearInterval(timer.current);
    setShown([0, 0, 0]);
    setDone(0);
    setRunning(null);
    setAnnounce("Cleared. Start with step 1.");
  };

  // "Your room" shows what was reachable from your account; it stays that way,
  // and the spare room carries its own result.
  const states: IconState[] = SECRETS.map((_, i) =>
    i < shown[0] ? (YOURS[i] === "visible" ? "reached" : "blocked") : "idle");

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3" role="group" aria-label="Replay the recorded run, one step at a time">
        {STEP_LABELS.map((label, i) => {
          const enabled = running === null && done >= i;
          const isNext = done === i;
          return (
            <button key={label} type="button" onClick={() => run(i)} disabled={!enabled}
              className={`min-h-12 rounded-md border px-4 py-2.5 text-left text-[15px] font-medium transition-colors disabled:cursor-not-allowed ${
                isNext && enabled ? "border-accent bg-accent text-white"
                  : done > i ? "border-accent bg-accent-soft text-ink"
                    : "border-line bg-card text-muted"}`}>
              {label}
              {done > i && <span className="sr-only"> (done)</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div>
          <YourRoom states={states} />
          <Panel title="Recorded in your account"
            empty="Press step 1 to replay what was reachable from your account.">
            {shown[0] > 0 ? (
              <>
                {SECRETS.slice(0, shown[0]).map((s, i) => <Line key={s.path} state={YOURS[i]} path={s.win} />)}
                {shown[0] === TOTAL && (
                  <div className="mt-2 font-sans text-[15px] font-semibold text-high">{YOURS_REACHED} of {TOTAL} reachable</div>
                )}
              </>
            ) : undefined}
          </Panel>
        </div>

        <div>
          <SpareRoom ready={done >= 2} checked={shown[2] === TOTAL} />
          <Panel title="Recorded while creating the spare room"
            empty="Step 2 replays the recorded setup.">
            {shown[1] > 0 ? (
              <>
                {SETUP_UNITS.slice(0, shown[1]).map((l) => <div key={l} className="mb-1">{l}</div>)}
                {shown[1] === SETUP_UNITS.length && (
                  <div className="mt-2 font-sans text-[15px] font-semibold text-ink">Ready in {acct.setup_wall_s} s</div>
                )}
              </>
            ) : undefined}
          </Panel>
          <Panel title="Recorded in the spare room"
            empty="Step 3 replays what was reachable from the spare room.">
            {shown[2] > 0 ? (
              <>
                {SECRETS.slice(0, shown[2]).map((s, i) => <Line key={s.path} state={SPARE[i]} path={s.win} />)}
                {shown[2] === TOTAL && (
                  <div className="mt-2 font-sans text-[15px] font-semibold text-ok">{SPARE_REACHED} of {TOTAL} reachable</div>
                )}
              </>
            ) : undefined}
          </Panel>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">{announce}</p>

      {done === 3 && (
        <div className="mt-8 flex flex-wrap items-baseline justify-between gap-4 border-t border-line pt-6">
          <p className="text-3xl font-semibold sm:text-5xl">
            <span className="text-high">{YOURS_REACHED} reachable</span>, then{" "}
            <span className="text-ok">{SPARE_REACHED}</span>
          </p>
          <button type="button" onClick={reset}
            className="min-h-11 rounded-md border border-line bg-card px-4 text-[15px] text-ink hover:border-accent">
            Start again
          </button>
        </div>
      )}
    </div>
  );
}
