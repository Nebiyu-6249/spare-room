import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { APP_NAME, REPO_URL } from "@/lib/data";

// next/font downloads these at build time and serves them from this site,
// so visitors' browsers never contact a font host.
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: `${APP_NAME}: run stranger code away from your keys`,
  description:
    "A Windows tool that shows what a take-home test could reach on your laptop, and sets up a separate account so it reaches nothing that matters.",
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
        <header className="border-b border-line bg-paper">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
            <Link href="/" className="text-base font-semibold text-ink no-underline">
              {APP_NAME}
            </Link>
            <nav aria-label="Main" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="text-ink/80 no-underline hover:text-accent">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-4xl space-y-2 px-4 py-8 text-sm text-muted sm:px-6">
            <p>
              A separate Windows account is weaker than a virtual machine. Malware with administrator rights,
              files every user can read, and your network or VPN can still be reached.
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
