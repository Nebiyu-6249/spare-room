// Record a captioned, voiceless walkthrough of the built browser demo (web/out).
//   cd tools/video && node record.mjs
// Writes demo-video/spare-room-walkthrough.mp4 and a matching .srt at the repo root.

import { createServer } from "node:http";
import { readFile, mkdir, rm, readdir, writeFile, stat } from "node:fs/promises";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";
import ffmpeg from "ffmpeg-static";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = join(ROOT, "web", "out");
const OUT_DIR = join(ROOT, "demo-video");
const RAW_DIR = join(OUT_DIR, "raw");
const PORT = 4322;
const SIZE = { width: 1280, height: 720 };

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2",
  ".json": "application/json", ".txt": "text/plain", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

// Minimal static server for the exported site.
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = join(SITE, p);
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    file = join(SITE, "404.html");
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${PORT}`;

// The caption bar: white card, ink text, IBM Plex from the page. No dark overlay.
const CAPTION_SCRIPT = () => {
  const install = () => {
    if (document.getElementById("sr-caption")) return;
    const el = document.createElement("div");
    el.id = "sr-caption";
    Object.assign(el.style, {
      position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)", zIndex: "9999",
      maxWidth: "1040px", width: "calc(100% - 96px)", padding: "14px 22px", borderRadius: "6px",
      background: "rgba(255,255,255,0.97)", color: "#1a1a1a", border: "1px solid #c9d6e2",
      borderLeft: "5px solid #1f5c8a", boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
      font: "500 22px/1.35 var(--font-plex-sans), system-ui, sans-serif", opacity: "0",
      transition: "opacity 250ms ease",
    });
    document.body.appendChild(el);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
};

const PACE = 0.85; // scales every caption's on-screen time; keeps the video between 2 and 3 minutes
const cues = [];
let t0 = 0;
const now = () => (Date.now() - t0) / 1000;

async function caption(page, text, seconds) {
  const start = now();
  await page.evaluate((t) => {
    const el = document.getElementById("sr-caption");
    el.textContent = t;
    el.style.opacity = "1";
  }, text);
  await page.waitForTimeout(seconds * 1000 * PACE);
  cues.push({ start, end: now(), text });
}

async function scrollBy(page, px, ms = 1500) {
  const steps = Math.max(1, Math.round(ms / 40));
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => window.scrollBy(0, d), px / steps);
    await page.waitForTimeout(40);
  }
}

async function scrollTo(page, selectorText) {
  await page.evaluate((txt) => {
    const el = [...document.querySelectorAll("h1,h2,p,summary")].find((e) => e.textContent.includes(txt));
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90, behavior: "smooth" });
  }, selectorText);
  await page.waitForTimeout(900);
}

async function go(page, path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
}

await rm(RAW_DIR, { recursive: true, force: true });
await mkdir(RAW_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: RAW_DIR, size: SIZE },
  colorScheme: "light", reducedMotion: "no-preference" });
await context.addInitScript(CAPTION_SCRIPT);
const page = await context.newPage();
t0 = Date.now();

// 1. Overview
await go(page, "/");
await caption(page, "Spare Room: see what code from a recruiter or client could reach on your Windows laptop.", 8);
await caption(page, "Everything here is replayed from the real tool, recorded on a test machine. All secrets are fake.", 8);
await scrollTo(page, "fake secrets reachable");
await caption(page, "The same probe checked the same 13 fake secrets: 13 were reachable from the normal account.", 9);
await caption(page, "From the separate interview account, 0 were reachable. Creating that account took 29.6 seconds.", 9);
await scrollTo(page, "The scan of the bundled fake laptop");
await caption(page, "The scan lists what code running as you could reach, by category and severity. It never reads a secret value.", 10);

// 2. Results
await go(page, "/results/");
await caption(page, "Results: each fake secret, checked once from each account.", 7);
await scrollTo(page, "Same probe, two accounts");
await scrollBy(page, 420, 4000);
await caption(page, "Reachable from the normal account. Blocked by Windows from the interview account.", 8);
await scrollTo(page, "verify, run inside");
await caption(page, "verify, run inside the interview account: all 12 known secret locations in the normal account were denied.", 10);
await caption(page, "It also found one .env that every account on the PC can read. A separate account cannot protect that file.", 10);
await scrollTo(page, "Setup time");
await caption(page, "Measured on Windows 11 Home. The first sign-in was not timed.", 7);
await scrollTo(page, "Coverage of public attacker");
await caption(page, "25 of 36 targets named in public attacker reports are covered. Each one links to its source.", 9);
await scrollBy(page, 500, 3500);
await scrollTo(page, "Everything the fake-laptop scan listed");
await page.locator("summary").first().click();
await page.waitForTimeout(600);
await caption(page, "Every finding gives the path, why it matters, and how to fix it.", 9);

// 3. Privacy
await go(page, "/privacy/");
await caption(page, "Privacy: exactly what the scan reads, and what it never does.", 8);
await scrollTo(page, "What it never does");
await caption(page, "No secret values printed, saved or sent. No network. Both are checked by automated tests.", 9);
await scrollTo(page, "What the account commands change");
await caption(page, "Only setup and remove-account need administrator rights. You type the password yourself.", 9);

// 4. Download
await go(page, "/download/");
await caption(page, "Download: one Windows exe. It is unsigned, so check its SHA-256 first.", 8);
await scrollTo(page, "Try the safe demo mode");
await caption(page, "Start with demo mode: no admin rights, and it touches only the fake laptop bundled inside.", 9);

// 5. Close
await go(page, "/");
await caption(page, "Limits: a separate account is weaker than a virtual machine. Admin malware and files every user can read are still exposed.", 10);
await caption(page, "Spare Room. Built during SafeSpace Hacks 2026, with Claude Code.", 6);

await context.close();
await browser.close();
server.close();

// Convert to MP4 (H.264) and write captions as SRT too.
const raw = (await readdir(RAW_DIR)).find((f) => f.endsWith(".webm"));
const mp4 = join(OUT_DIR, "spare-room-walkthrough.mp4");
const r = spawnSync(ffmpeg, ["-y", "-i", join(RAW_DIR, raw), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "23",
  "-preset", "medium", "-movflags", "+faststart", "-an", mp4], { stdio: "inherit" });
if (r.status !== 0) throw new Error("ffmpeg failed");
await rm(RAW_DIR, { recursive: true, force: true });

const ts = (s) => {
  const ms = Math.round(s * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const sec = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return `${h}:${m}:${sec},${String(ms % 1000).padStart(3, "0")}`;
};
await writeFile(join(OUT_DIR, "spare-room-walkthrough.srt"),
  cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n"), "utf8");
console.log(`Wrote ${mp4} (${Math.round(now())} s recorded, ${cues.length} captions)`);
