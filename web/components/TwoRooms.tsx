"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { acct, cellsFor, KIND_OF, KIND_ORDER, setupLines, SHORT_NAMES, twin, winPath, type Kind } from "@/lib/data";

// ---- recorded data ---------------------------------------------------------

const SECRETS = twin.matrix.secrets.map((s, i) => ({
  ...s, i, kind: KIND_OF[s.category] as Kind, win: winPath(s.path), name: SHORT_NAMES[s.path] ?? s.path,
}));
const YOURS = cellsFor("normal");
const SPARE = cellsFor("interview");
const TOTAL = SECRETS.length;
const YOURS_REACHED = YOURS.filter((c) => c === "visible").length;
const SPARE_REACHED = SPARE.filter((c) => c === "visible").length;
const SPARE_BLOCKED = SPARE.filter((c) => c === "blocked").length;

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

// Items in the room, grouped by kind; two columns of rows.
const ROOM_ORDER = [...SECRETS].sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.i - b.i);
const ROWS = Math.ceil(ROOM_ORDER.length / 2);
const ROW_H = 48;
const TOP = 58;
const H = TOP + ROWS * ROW_H + 34; // room height in viewBox units
const COL_X = [22, 198];

// ---- drawing ---------------------------------------------------------------

type ItemState = "idle" | "reachable" | "blocked";

function KindIcon({ kind }: { kind: Kind }) {
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

const TONE: Record<ItemState, { stroke: string; halo: string; text: string }> = {
  idle: { stroke: "var(--muted)", halo: "transparent", text: "var(--muted)" },
  reachable: { stroke: "var(--high)", halo: "#f7e4e7", text: "var(--high)" },
  blocked: { stroke: "var(--ok)", halo: "#e3efe6", text: "var(--ok)" },
};

function Walls({ title }: { title: string }) {
  const b = H - 8;
  return (
    <>
      <path d={`M262 ${b}H8V8h364v${b - 8}h-50`} fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      <path d={`M262 ${b}V${b - 54}`} stroke="var(--ink)" strokeWidth="2" />
      <path d={`M262 ${b - 54}A54 54 0 0 1 316 ${b}`} fill="none" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="4 4" />
      <text x="22" y="38" fontSize="16" fontWeight="600" fill="var(--ink)">{title}</text>
    </>
  );
}

/** Small state mark drawn before the word: a filled dot for reachable, a lock for blocked. */
function StateMark({ state, x, y }: { state: ItemState; x: number; y: number }) {
  if (state === "reachable") return <circle cx={x + 5} cy={y - 5} r="4.5" fill="var(--high)" />;
  if (state === "blocked") {
    return (
      <g fill="none" stroke="var(--ok)" strokeWidth="1.6" strokeLinecap="round">
        <rect x={x} y={y - 9} width="10" height="8" rx="1.5" fill="var(--ok)" />
        <path d={`M${x + 2.2} ${y - 9}v-2.5a2.8 2.8 0 0 1 5.6 0v2.5`} />
      </g>
    );
  }
  return null;
}

function YourRoom({ states }: { states: ItemState[] }) {
  const reachable = states.filter((s) => s === "reachable").length;
  const blocked = states.filter((s) => s === "blocked").length;
  const label = blocked ? `${blocked} of ${TOTAL} blocked when tried from the spare room`
    : reachable ? `${reachable} of ${TOTAL} reachable from your account` : "not checked yet";
  return (
    <svg viewBox={`0 0 380 ${H}`} className="block h-auto w-full" role="img"
      aria-label={`Your room: ${TOTAL} fake secrets, ${label}.`}>
      <Walls title="Your room" />
      {ROOM_ORDER.map((s, n) => {
        const st = states[s.i];
        const t = TONE[st];
        const x = COL_X[n < ROWS ? 0 : 1];
        const y = TOP + (n % ROWS) * ROW_H;
        return (
          <g key={s.path}>
            <circle cx={x + 14} cy={y + 18} r="16" fill={t.halo} />
            <g transform={`translate(${x + 2} ${y + 6})`} fill="none" stroke={t.stroke}
              strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <KindIcon kind={s.kind} />
            </g>
            <text x={x + 38} y={y + 15} fontSize="14" fill="var(--ink)">{s.name}</text>
            {st !== "idle" && (
              <>
                <StateMark state={st} x={x + 38} y={y + 34} />
                <text x={x + 53} y={y + 34} fontSize="14" fontWeight="600" fill={t.text}>{st}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function SpareRoom({ phase }: { phase: "none" | "ready" | "trying" | "tried" }) {
  const lines = {
    none: ["Not created yet"],
    ready: ["Empty. Nothing to take."],
    trying: ["Empty.", `Trying the same ${TOTAL} paths...`],
    tried: ["Empty.", `Tried the same ${TOTAL} paths:`, `${SPARE_BLOCKED} blocked`],
  }[phase];
  const y0 = H / 2 - (lines.length - 1) * 12;
  return (
    <svg viewBox={`0 0 380 ${H}`} className="block h-auto w-full" role="img"
      aria-label={`The spare room: ${lines.join(" ")}`}>
      <Walls title="The spare room" />
      {lines.map((l, i) => (
        <text key={l} x="190" y={y0 + i * 24} textAnchor="middle" fontSize="16"
          fill={phase === "tried" && i === 2 ? "var(--ok)" : "var(--muted)"}
          fontWeight={phase === "tried" && i === 2 ? 600 : 400}>{l}</text>
      ))}
    </svg>
  );
}

// ---- recorded output panels -----------------------------------------------

function Panel({ title, empty, lines, footer, panelRef }: {
  title: string; empty: string; lines: React.ReactNode[]; footer?: React.ReactNode;
  panelRef: React.RefObject<HTMLDivElement | null>;
}) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { if (body.current) body.current.scrollTop = body.current.scrollHeight; }, [lines.length, footer]);
  return (
    <div ref={panelRef} className="scroll-mt-4 rounded-md border border-line bg-[#f3f4f0] font-mono text-[13px] leading-6">
      <div className="border-b border-line px-3 py-1.5 font-sans text-[13px] text-muted">{title}</div>
      <div ref={body} tabIndex={0} role="log" aria-label={title} className="max-h-72 min-h-20 overflow-y-auto px-3 py-2 md:max-h-none">
        {lines.length ? lines : <span className="font-sans text-muted">{empty}</span>}
        {footer}
      </div>
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
  const panels = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];

  const summary = (step: number) =>
    step === 0 ? `${YOURS_REACHED} of ${TOTAL} fake secrets reachable from your account.`
      : step === 1 ? `Spare room created in ${acct.setup_wall_s} seconds.`
        : `The same ${TOTAL} paths, tried from the spare room: ${SPARE_BLOCKED} blocked.`;

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
    setShown((s) => s.map((v, i) => (i < step ? LINE_COUNTS[i] : 0)));
    setDone(step);
    panels[step].current?.scrollIntoView({ behavior: reduced.current ? "auto" : "smooth", block: "nearest" });
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

  // Each item in "Your room": reachable once step 1 prints its line; locked
  // and blocked once step 3 tries the same path from the spare room.
  const states: ItemState[] = SECRETS.map((_, i) =>
    i < shown[2] ? (SPARE[i] === "visible" ? "reachable" : "blocked")
      : i < shown[0] ? (YOURS[i] === "visible" ? "reachable" : "blocked") : "idle");
  const sparePhase = shown[2] === TOTAL ? "tried" : shown[2] > 0 || running === 2 ? "trying" : done >= 2 ? "ready" : "none";

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

      {/* DOM order (room, its output; room, its output; summary) reads well on phones.
          On wider screens the grid shows both rooms, then the summary, then each output under its room. */}
      <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
        <div className="order-1"><YourRoom states={states} /></div>
        <div className="order-2 md:order-4">
          <Panel panelRef={panels[0]} title="Recorded in your account"
            empty="Press step 1 to replay what was reachable from your account."
            lines={SECRETS.slice(0, shown[0]).map((s) => <Line key={s.path} state={YOURS[s.i]} path={s.win} />)}
            footer={shown[0] === TOTAL &&
              <div className="mt-2 font-sans text-[15px] font-semibold text-high">{YOURS_REACHED} of {TOTAL} reachable</div>} />
        </div>
        <div className="order-3 md:order-2"><SpareRoom phase={sparePhase} /></div>
        <div className="order-4 space-y-4 md:order-5">
          <Panel panelRef={panels[1]} title="Recorded while creating the spare room"
            empty="Step 2 replays the recorded setup."
            lines={SETUP_UNITS.slice(0, shown[1]).map((l) => <div key={l} className="mb-1">{l}</div>)}
            footer={shown[1] === SETUP_UNITS.length &&
              <div className="mt-2 font-sans text-[15px] font-semibold text-ink">Ready in {acct.setup_wall_s} s</div>} />
          <Panel panelRef={panels[2]} title="Recorded in the spare room"
            empty="Step 3 tries the same paths from the spare room."
            lines={SECRETS.slice(0, shown[2]).map((s) => <Line key={s.path} state={SPARE[s.i]} path={s.win} />)}
            footer={shown[2] === TOTAL &&
              <div className="mt-2 font-sans text-[15px] font-semibold text-ok">{SPARE_REACHED} of {TOTAL} reachable</div>} />
        </div>

        <div className="order-5 md:order-3 md:col-span-2">
          <div className="min-h-16 border-y border-line py-4">
            {done === 0 && <p className="text-muted">Press step 1 to start.</p>}
            {done >= 1 && done < 3 && (
              <p className="text-lg font-semibold text-high">{YOURS_REACHED} of {TOTAL} reachable from your account</p>
            )}
            {done === 3 && (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-3xl font-semibold sm:text-4xl">
                    <span className="text-high">{YOURS_REACHED} reachable</span>, then{" "}
                    <span className="text-ok">{SPARE_REACHED}</span>
                  </p>
                  <p className="mt-1 text-lg">Before you run a stranger&apos;s code, give it a spare room.</p>
                  <p className="mt-1 text-[15px] text-ok">
                    The same {TOTAL} paths, tried from the spare room: {SPARE_BLOCKED} blocked
                  </p>
                </div>
                <button type="button" onClick={reset}
                  className="min-h-11 rounded-md border border-line bg-card px-4 text-[15px] text-ink hover:border-accent">
                  Start again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p aria-live="polite" className="sr-only">{announce}</p>
    </div>
  );
}
