"use client";

import { useEffect, useState } from "react";

/**
 * "On this page" for the home page, at 1200 px and wider only. Fixed to the
 * left of the content once the hero has scrolled away; the section in view
 * is marked (aria-current plus a bar, not colour alone).
 */
export default function PageRail({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("hero-title")?.closest("section");
    const heroObs = hero ? new IntersectionObserver(([e]) => setShown(!e.isIntersecting), { threshold: 0 }) : null;
    if (hero) heroObs!.observe(hero);

    // The current section is the last one whose top has passed a line a third of the way down.
    const onScroll = () => {
      const line = window.innerHeight / 3;
      let cur = items[0]?.id;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= line) cur = it.id;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { heroObs?.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, [items]);

  return (
    <nav aria-label="On this page"
      className={`fixed top-[calc(var(--header-h)+32px)] z-40 hidden w-[216px] rounded-lg border border-line bg-paper/95 p-4 shadow-[0_6px_24px_rgba(15,28,48,.10)] backdrop-blur transition-opacity duration-200 min-[1200px]:block ${
        shown ? "opacity-100" : "pointer-events-none invisible opacity-0"}`}
      style={{ left: "max(24px, calc((100vw - 1200px) / 2 + 32px))" }}>
      <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-muted">On this page</p>
      <ul>
        {items.map((it) => {
          const on = it.id === active;
          return (
            <li key={it.id}>
              <a href={`#${it.id}`} aria-current={on ? "true" : undefined}
                className={`flex min-h-10 items-center border-l-[3px] pl-3 text-[15px] no-underline ${
                  on ? "border-accent font-bold text-ink" : "border-transparent font-medium text-muted hover:text-ink"}`}>
                {it.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
