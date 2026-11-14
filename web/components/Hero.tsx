import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The hero image is made at build time (tools/video/hero.mjs) from the tool's
 * own recorded probe output: the 13 "reachable" lines, set large and tilted.
 * It is decorative, so its alt text is empty; the shade keeps text on top readable.
 */
function HeroImage() {
  return (
    <>
      <img src="/hero-1920.webp" srcSet="/hero-960.webp 960w, /hero-1920.webp 1920w" sizes="100vw"
        alt="" width={1920} height={1080} fetchPriority="high" decoding="async"
        className="hero-img absolute inset-0 -z-20 h-full w-full object-cover object-[68%_50%]" />
      <div aria-hidden className="hero-shade absolute inset-0 -z-10" />
    </>
  );
}

type Stat = { value: string; label: string; mark: "reachable" | "blocked" | "time" };

function StatMark({ mark }: { mark: Stat["mark"] }) {
  if (mark === "reachable") return <span aria-hidden className="mt-2 inline-block h-3 w-3 shrink-0 rounded-full bg-[#ff6b6b]" />;
  if (mark === "blocked") return <span aria-hidden className="mt-2 inline-block h-3 w-3 shrink-0 rounded-[2px] border-2 border-[#7fd49a]" />;
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="mt-1.5 h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="8" r="6.2" /><path d="M8 4.5V8l2.4 1.6" strokeLinecap="round" />
    </svg>
  );
}

/** Home: about 80% of the screen, headline, two buttons and a stat strip along the bottom edge. */
export function HomeHero({ stats }: { stats: Stat[] }) {
  return (
    <section aria-labelledby="hero-title" className="on-dark relative isolate flex min-h-[80vh] flex-col overflow-hidden bg-navy text-white">
      <HeroImage />
      <div className="wrap flex flex-1 flex-col justify-center pb-10 pt-[calc(var(--header-h)+40px)]">
        <div className="max-w-[900px]">
          <h1 id="hero-title" className="text-[40px] font-extrabold leading-[1.05] tracking-tight sm:text-[56px] lg:text-[68px]">
            Run the recruiter&apos;s code in a room with nothing in it.
          </h1>
          <p className="mt-6 max-w-[620px] text-lg text-white/90 sm:text-xl">
            Spare Room shows what a take-home test could reach on your Windows laptop, then sets up a separate account,
            the spare room, where it reaches nothing that matters.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/#video" className="btn btn-accent">Watch the 2-minute demo</Link>
            <Link href="/download/" className="btn btn-ghost">Download for Windows</Link>
          </div>
          <p className="mt-6 max-w-[620px] text-[15px] text-white/80">
            Built for SafeSpace Hacks 2026. Every number on this site is replayed from the real tool; all secrets are fake.
          </p>
        </div>
      </div>
      <div className="border-t border-white/15 bg-[rgba(5,10,18,.55)]">
        <ul className="wrap grid grid-cols-1 gap-x-8 gap-y-3 py-5 sm:grid-cols-3" aria-label="Recorded results">
          {stats.map((s) => (
            <li key={s.label} className="flex items-start gap-3">
              <StatMark mark={s.mark} />
              <span>
                <span className="text-[28px] font-extrabold leading-none tabular-nums sm:text-[32px]">{s.value}</span>{" "}
                <span className="text-[15px] font-medium text-white/85 sm:block sm:pt-1">{s.label}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Other pages: a shorter band of the same image with the page title. */
export function PageHero({ title, lead }: { title: string; lead?: ReactNode }) {
  return (
    <section aria-labelledby="page-title" className="on-dark relative isolate flex min-h-[40vh] flex-col justify-end overflow-hidden bg-navy text-white">
      <HeroImage />
      <div className="wrap pb-10 pt-[calc(var(--header-h)+40px)] sm:pb-14">
        <h1 id="page-title" className="text-[40px] font-extrabold leading-tight tracking-tight sm:text-[56px]">{title}</h1>
        {lead && <p className="mt-3 max-w-[680px] text-lg text-white/90 sm:text-xl">{lead}</p>}
      </div>
    </section>
  );
}
