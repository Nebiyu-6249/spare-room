"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DoorMark } from "@/components/ui";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/results/", label: "Results" },
  { href: "/privacy/", label: "Privacy" },
  { href: "/download/", label: "Download" },
];

/**
 * Sticky header. Over the dark hero it is transparent with white text; once the
 * page scrolls (or the phone menu opens) it turns white with a thin border.
 * Right: two full-height accent tiles. Phones: wordmark, Download tile, Menu.
 */
export default function SiteHeader({ appName }: { appName: string }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); menuBtn.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const solid = scrolled || open;
  const current = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const linkText = solid ? "text-ink hover:text-accent-ink" : "text-white hover:text-accent";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 h-[var(--header-h)] transition-colors duration-200 ${
        solid ? "border-b border-line bg-paper" : "on-dark border-b border-transparent bg-transparent"}`}>
      <div className="flex h-full items-stretch">
        <Link href="/" className={`flex min-h-11 items-center gap-2.5 pl-4 pr-3 text-[19px] font-extrabold tracking-tight no-underline sm:pl-8 ${
          solid ? "text-ink" : "text-white"}`}>
          <DoorMark className={`h-7 w-6 ${solid ? "text-accent-ink" : "text-accent"}`} />
          {appName}
        </Link>

        <nav aria-label="Main" className="ml-6 hidden flex-1 items-stretch lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(n.href) ? "page" : undefined}
              className={`relative flex items-center px-4 text-[16px] font-semibold no-underline ${linkText}`}>
              {n.label}
              {current(n.href) && <span aria-hidden className="absolute inset-x-4 bottom-4 h-0.5 rounded-full bg-accent" />}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-stretch">
          <Link href="/#video" className="hidden items-center bg-accent px-6 text-[16px] font-bold text-navy no-underline hover:bg-[#f2b65a] lg:flex">
            Watch the demo
          </Link>
          <Link href="/download/" className="flex items-center border-l border-navy/15 bg-accent px-4 text-[16px] font-bold text-navy no-underline hover:bg-[#f2b65a] sm:px-6">
            Download
          </Link>
          <button ref={menuBtn} type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="site-menu"
            className={`flex min-w-14 flex-col items-center justify-center gap-1 px-3 text-[13px] font-semibold lg:hidden ${solid ? "text-ink" : "text-white"}`}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
            <span>{open ? "Close" : "Menu"}</span>
          </button>
        </div>
      </div>

      <nav id="site-menu" aria-label="Main" hidden={!open}
        className="border-b border-line bg-paper shadow-[0_8px_16px_rgba(15,28,48,.08)] lg:hidden">
        <ul className="wrap py-2">
          {[...NAV, { href: "/#video", label: "Watch the demo" }].map((n) => (
            <li key={n.href} className="border-b border-line last:border-0">
              <Link href={n.href} aria-current={current(n.href) && n.href !== "/#video" ? "page" : undefined}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center text-[17px] font-semibold text-ink no-underline">
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
