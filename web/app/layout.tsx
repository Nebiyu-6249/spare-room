import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Figtree, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { DoorMark } from "@/components/ui";
import { APP_NAME, cov, DOWNLOAD_URL, RELEASE_URL, REPO_URL } from "@/lib/data";

// next/font downloads these at build time and serves them from this site,
// so visitors' browsers never contact a font host.
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });
// Not used on the pages: tools/video/edit.mjs renders the video's cards in Plex
// Sans from this build. Browsers only download a font a page actually uses.
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans", preload: false });

export const metadata: Metadata = {
  title: `${APP_NAME}: run the recruiter's code in a room with nothing in it`,
  description:
    "A Windows tool that shows what a take-home test could reach on your laptop, and sets up a separate account where it reaches nothing that matters.",
  referrer: "no-referrer",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0a1424" };

const SITE_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/results/", label: "Results" },
  { href: "/privacy/", label: "Privacy" },
  { href: "/download/", label: "Download" },
];

/** The public reports the checks cite, once each, in first-seen order. */
function sources() {
  const seen = new Map<string, string>();
  for (const c of cov) if (!seen.has(c.attacker_source.name)) seen.set(c.attacker_source.name, c.attacker_source.url);
  return [...seen].map(([name, url]) => ({ name, url }));
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${mono.variable} ${plexSans.variable}`}>
      <body className="min-h-screen">
        <a href="#main" className="sr-only z-[60] focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:rounded focus:bg-paper focus:px-3 focus:py-2 focus:text-ink">
          Skip to content
        </a>
        <SiteHeader appName={APP_NAME} downloadUrl={DOWNLOAD_URL} />
        <main id="main">{children}</main>
        <footer className="on-dark bg-navy text-white">
          <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
            <div>
              <Link href="/" className="inline-flex min-h-11 items-center gap-2.5 text-[19px] font-extrabold text-white no-underline">
                <DoorMark className="h-7 w-6 text-accent" />{APP_NAME}
              </Link>
              <p className="mt-3 max-w-[420px] text-[15px] text-white/80">
                A separate Windows account is weaker than a virtual machine. Malware with administrator rights, files
                every user can read, and your network or VPN can still be reached.
              </p>
            </div>
            <nav aria-label="Site">
              <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-white/70">Site</p>
              <ul>
                {SITE_LINKS.map((l) => (
                  <li key={l.href}><Link href={l.href} className="inline-flex min-h-11 items-center text-[16px] font-semibold text-white no-underline hover:text-accent">{l.label}</Link></li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Code">
              <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-white/70">Code</p>
              <ul>
                <li><a href={REPO_URL} className="inline-flex min-h-11 items-center text-[16px] font-semibold text-white no-underline hover:text-accent">Source on GitHub</a></li>
                <li><a href={RELEASE_URL} className="inline-flex min-h-11 items-center text-[16px] font-semibold text-white no-underline hover:text-accent">Latest release</a></li>
              </ul>
            </nav>
          </div>
          <div className="border-t border-white/15">
            <div className="wrap space-y-2 py-8 text-[15px] text-white/80">
              <p className="font-semibold text-white">Built for SafeSpace Hacks 2026.</p>
              <p>
                Made with Claude Code. Type: Figtree and IBM Plex Mono. Attacker targets from public reports:{" "}
                {sources().map((s, i, a) => (
                  <span key={s.name}><a href={s.url}>{s.name}</a>{i < a.length - 1 ? "; " : "."}</span>
                ))}
              </p>
              <p>No analytics, no cookies, no trackers. This site loads nothing from other hosts.</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
