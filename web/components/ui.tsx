import type { ReactNode } from "react";
import type { Severity } from "@/lib/data";
import { recorded } from "@/lib/data";

const SEV_CLASS: Record<Severity, string> = { high: "text-high", medium: "text-medium", info: "text-info" };
const SEV_SWATCH: Record<Severity, string> = { high: "bg-high", medium: "bg-medium", info: "bg-info" };

/** Severity as a shape plus a word, never colour alone. */
export function SeverityTag({ level }: { level: Severity }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide ${SEV_CLASS[level]}`}>
      <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-[2px] ${SEV_SWATCH[level]}`} />
      {level}
    </span>
  );
}

/** Reachable (filled dot) or blocked (hollow square): shape plus word. */
export function StateTag({ state }: { state: string }) {
  const reachable = state === "visible";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium ${reachable ? "text-high" : "text-ok"}`}>
      <span aria-hidden
        className={`inline-block h-2.5 w-2.5 ${reachable ? "rounded-full bg-high" : "rounded-[2px] border-2 border-ok"}`} />
      {reachable ? "reachable" : state === "blocked" ? "blocked" : "absent"}
    </span>
  );
}

export function Path({ children }: { children: ReactNode }) {
  return <code className="path text-[13px] text-ink/85">{children}</code>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-line bg-card p-5 sm:p-6 ${className}`}>{children}</div>;
}

/** One size for every headline number on the site; it never wraps. */
export const BIG_NUMBER = "whitespace-nowrap text-5xl font-semibold leading-none tabular-nums sm:text-6xl";

export function BigNumber({ value, label, tone = "ink" }: { value: ReactNode; label: ReactNode; tone?: "ink" | "high" | "ok" }) {
  const color = tone === "high" ? "text-high" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <div>
      <div className={`${BIG_NUMBER} ${color}`}>{value}</div>
      <div className="mt-3 text-base text-ink sm:text-lg">{label}</div>
    </div>
  );
}

export function RecordedNote() {
  return (
    <p className="text-sm text-muted">
      Recorded from the real tool on a test machine on {recorded.recorded_on}. Every number and path on this site is
      replayed from that output. All secrets are fake and marked FAKE-DEMO.
    </p>
  );
}

export function SectionTitle({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 id={id} className="mt-14 mb-4 border-b border-line pb-2 text-xl font-semibold">{children}</h2>;
}

/** A small line-drawn door: frame, open leaf, handle. */
export function DoorMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 28" aria-hidden="true" className={className} fill="none" stroke="currentColor"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 26V3h14v23" />
      <path d="M2 26h20" />
      <path d="M8 26V6.5L15 4.5v21.5" />
      <circle cx="12.6" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
