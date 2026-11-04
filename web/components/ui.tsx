import type { ReactNode } from "react";
import type { Severity } from "@/lib/data";
import { recorded } from "@/lib/data";

const SEV_CLASS: Record<Severity, string> = {
  high: "text-high",
  medium: "text-medium",
  info: "text-info",
};
const SEV_SWATCH: Record<Severity, string> = {
  high: "bg-high",
  medium: "bg-medium",
  info: "bg-info",
};

/** Severity as a shape plus a word, never colour alone. */
export function SeverityTag({ level }: { level: Severity }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${SEV_CLASS[level]}`}>
      <span aria-hidden className={`inline-block h-2.5 w-2.5 rounded-[2px] ${SEV_SWATCH[level]}`} />
      {level}
    </span>
  );
}

export function StateTag({ state }: { state: string }) {
  const visible = state === "visible";
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${visible ? "text-high" : "text-ok"}`}>
      <span
        aria-hidden
        className={`inline-block h-2.5 w-2.5 ${visible ? "rounded-full bg-high" : "rounded-[2px] border-2 border-ok"}`}
      />
      {visible ? "reachable" : state === "blocked" ? "blocked" : "absent"}
    </span>
  );
}

export function Path({ children }: { children: ReactNode }) {
  return <code className="path text-[13px] text-ink/85">{children}</code>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-line bg-card p-5 sm:p-6 ${className}`}>{children}</div>;
}

export function BigNumber({ value, label, tone = "ink" }: { value: ReactNode; label: ReactNode; tone?: "ink" | "high" | "ok" }) {
  const color = tone === "high" ? "text-high" : tone === "ok" ? "text-ok" : "text-ink";
  return (
    <div>
      <div className={`text-6xl font-semibold leading-none tabular-nums ${color}`}>{value}</div>
      <div className="mt-2 text-lg text-ink">{label}</div>
    </div>
  );
}

export function RecordedNote() {
  return (
    <p className="text-sm text-muted">
      Recorded from the real tool on a test machine on {recorded.recorded_on}. Every number and path on
      this site is replayed from that output; all secrets are fake and marked FAKE-DEMO.
    </p>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-12 mb-4 border-b border-line pb-2 text-lg font-semibold">{children}</h2>;
}
