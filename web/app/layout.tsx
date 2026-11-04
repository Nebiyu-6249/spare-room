import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { DoorMark } from "@/components/ui";
import { APP_NAME, REPO_URL } from "@/lib/data";

// next/font downloads these at build time and serves them from this site,
// so visitors' browsers never contact a font host.
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: `${APP_NAME}: run the recruiter's code in a room with nothing in it`,
  description:
    "A Windows tool that shows what a take-home test could reach on your laptop, and sets up a separate account where it reaches nothing that matters.",
  referrer: "no-referrer",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fafaf7" };

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/results/", label: "Results" },
  { href: "/privacy/", label: "Privacy" },
  { href: "/download/", label: "Download" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:rounded focus:bg-card focus:px-3 focus:py-2">
          Skip to content
        </a>
        <header className="border-b border-line bg-paper">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 px-4 py-2 sm:px-6">
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-base font-semibold text-ink no-underline">
              <DoorMark className="h-6 w-5 text-accent" />
              {APP_NAME}
            </Link>
            <nav aria-label="Main" className="-mx-2 flex flex-wrap text-[15px]">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}
                  className="inline-flex min-h-11 items-center px-2 text-ink/80 no-underline hover:text-accent sm:px-3">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl space-y-2 px-4 py-8 text-sm text-muted sm:px-6">
            <p>
              A separate Windows account is weaker than a virtual machine. Malware with administrator rights, files
              every user can read, and your network or VPN can still be reached.
            </p>
            <p>
              This site has no analytics, no cookies and no trackers. It loads nothing from other sites.{" "}
              <a href={REPO_URL}>Source on GitHub</a>.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
