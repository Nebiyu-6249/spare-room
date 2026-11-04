// Edit the raw clips from tools/record_demo.ps1 into one 60-90 s video.
//   cd tools/video && node edit.mjs
// Writes web/public/real-demo.mp4 (1920x1080 H.264, captions burned in) and
// web/public/real-demo.vtt. Cards and captions are rendered with Playwright in
// the site's own IBM Plex (from the built site); cutting is done by ffmpeg.

import { chromium } from "playwright";
import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAW = join(ROOT, "demo-video", "raw");
const WORK = join(ROOT, "tools", "video", "edit-work");
const OUT_MP4 = join(ROOT, "web", "public", "real-demo.mp4");
const OUT_VTT = join(ROOT, "web", "public", "real-demo.vtt");
const SITE_CSS_DIR = join(ROOT, "web", "out", "_next", "static", "chunks");
const W = 1920, H = 1080, FPS = 30;
const PAPER = "#fafaf7", CONSOLE_BG = "0xF2F2F2";

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const readJson = (f) => JSON.parse(readFileSync(f, "utf8").replace(/^\uFEFF/, ""));
const clips = Object.fromEntries(readJson(join(RAW, "clips.json")).map((c) => [c.name, c]));
const tl = { your: readJson(join(RAW, "timeline-your.json")), spare: readJson(join(RAW, "timeline-spare.json")) };
const rel = (clip, iso) => (new Date(iso) - new Date(clips[clip].started)) / 1000;

function run(args, label) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${label}): ${r.stderr}`);
  return r;
}

// ---- calibration: when does a step's output really appear in the clip? ----
// Each step clears the console, so row 2 (just under the typed command) is
// empty until the command prints. Find the first frame where it is not.
function firstInk(clip, fromSec, toSec) {
  const file = join(RAW, `${clip}.mkv`);
  const r = spawnSync(ffmpeg, ["-hide_banner", "-ss", String(fromSec), "-to", String(toSec), "-i", file,
    "-vf", "crop=560:24:56:40,signalstats,metadata=print:key=lavfi.signalstats.YMIN", "-f", "null", "-"],
  { encoding: "utf8" });
  const lines = (r.stderr || "").split(/\r?\n/);
  let t = null;
  for (const l of lines) {
    const pt = l.match(/pts_time:([0-9.]+)/);
    if (pt) t = parseFloat(pt[1]);
    const y = l.match(/YMIN=([0-9.]+)/);
    if (y && t !== null && parseFloat(y[1]) < 120) return fromSec + t; // dark pixels = text
  }
  return null;
}

function stepTimes(clip, role) {
  return tl[role].map((s) => ({
    command: s.command, start: rel(clip, s.start), out: rel(clip, s.output_done), end: rel(clip, s.end),
  }));
}
const Y = stepTimes("your-account", "your");
const S = stepTimes("spare-room", "spare");
// Measured appearance of each step's output (falls back to the log time).
for (const [clip, steps] of [["your-account", Y], ["spare-room", S]]) {
  for (const s of steps) {
    const seen = firstInk(clip, s.start + 0.2, s.end);
    s.ink = seen ?? s.out;
  }
}
console.log("calibrated:", JSON.stringify({ your: Y.map((s) => +s.ink.toFixed(2)), spare: S.map((s) => +s.ink.toFixed(2)) }));

// ---- cards and captions (Playwright, IBM Plex from the built site) ----------
const css = readdirSync(SITE_CSS_DIR).filter((f) => f.endsWith(".css"))
  .find((f) => readFileSync(join(SITE_CSS_DIR, f), "utf8").includes("IBM Plex Sans"));
if (!css) throw new Error("Build the site first (web/out) so its IBM Plex fonts are available.");
const cssUrl = pathToFileURL(join(SITE_CSS_DIR, css)).href;
const page = (body, transparent) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${cssUrl}">
<style>
  html,body{margin:0;width:${W}px;height:${H}px;background:${transparent ? "transparent" : PAPER};color:#1a1a1a;
    font-family:"IBM Plex Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .card{box-sizing:border-box;height:100%;padding:0 200px;display:flex;flex-direction:column;justify-content:center}
  .rule{width:120px;height:6px;background:#1f5c8a;margin-bottom:48px}
  h1{font-size:76px;line-height:1.15;font-weight:600;margin:0;max-width:1500px}
  p{font-size:44px;line-height:1.35;margin:0;max-width:1480px}
  .small{font-size:30px;color:#5b6573;margin-top:40px}
  .big{font-size:96px;font-weight:600;margin-bottom:24px}
  .high{color:#a8001d}.ok{color:#2d6a3e}
  .cap{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);box-sizing:border-box;width:1640px;
    padding:22px 34px;background:rgba(255,255,255,.97);border:1px solid #c9d6e2;border-left:8px solid #1f5c8a;
    border-radius:8px;font-size:36px;line-height:1.35;font-weight:500;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .redact{position:absolute;background:${CONSOLE_BG.replace("0x", "#")};font-family:Consolas,monospace;color:#0c0c0c;white-space:pre}
</style></head><body>${body}</body></html>`;

const CARDS = {
  title: { secs: 4.5, html: `<div class="card"><div class="rule"></div><h1>Spare Room: run the recruiter's code in a room with nothing in it.</h1></div>`,
    vtt: "Spare Room: run the recruiter's code in a room with nothing in it." },
  context: { secs: 6, html: `<div class="card"><div class="rule"></div>
    <p>Binance's $6.34B loss involved an engineer running a recruiter's coding assignment on his work computer.</p>
    <p class="small">Source: Binance's incident report, as reported by TheStreet (Yahoo Finance), November 3, 2026.</p></div>`,
    vtt: "Binance's $6.34B loss involved an engineer running a recruiter's coding assignment on his work computer." },
  setup: { secs: 6, html: `<div class="card"><div class="rule"></div>
    <p>Creating the spare room took <b>29.6 s</b>.</p>
    <p class="small">Recorded earlier. Windows does not allow its permission prompt to be screen-recorded.</p></div>`,
    vtt: "Creating the spare room took 29.6 s (recorded earlier; Windows does not allow its permission prompt to be screen-recorded)." },
  end: { secs: 6.5, html: `<div class="card"><div class="rule"></div>
    <div class="big"><span class="high">13 reachable</span>, then <span class="ok">0</span>.</div>
    <p>Offline. Never reads secret contents. Weaker than a virtual machine.</p>
    <p class="small">spare-room-demo.netlify.app</p></div>`,
    vtt: "13 reachable, then 0. Offline. Never reads secret contents. Weaker than a virtual machine. spare-room-demo.netlify.app" },
};

const CAPTIONS = {
  c1: "Your account: the one you use every day, with your keys, logins and wallets.",
  c2: "Spare Room's scan of a bundled fake laptop: 25 things code running as you could reach. It never reads their contents.",
  c3: "The same results as a local report. It loads nothing from the internet.",
  c4: "The check a stranger's code could make, against 13 fake secrets in your folder: all 13 reachable.",
  c5: "The spare room: a separate, standard Windows account with nothing in it.",
  c6: "Can the coding test run here? Node.js, npm and Git, yes. Python and VS Code need installing for all users.",
  c7: "The same 13 paths, tried from the spare room: 13 blocked.",
  c8: "Checked from inside: none of the 12 secret locations in your account are readable. One .env outside any account folder still is.",
};

// The real project folder name in verify's output is covered with <project>.
// Line measured on the recording: starts at x=242, Consolas ~15.6 px per character.
const REDACT = { x: 242, y: 226, w: 380, h: 38, text: "C:\\dev\\<project>\\.env", size: 28.4, top: 229 };

const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: W, height: H } });
async function render(name, body, transparent = false) {
  const f = join(WORK, `${name}.html`);
  writeFileSync(f, page(body, transparent), "utf8");
  await pg.goto(pathToFileURL(f).href, { waitUntil: "load" });
  await pg.evaluate(() => document.fonts.ready);
  const png = join(WORK, `${name}.png`);
  await pg.screenshot({ path: png, omitBackground: transparent });
  return png;
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
for (const [k, c] of Object.entries(CARDS)) c.png = await render(`card-${k}`, c.html);
const capPng = {};
for (const [k, t] of Object.entries(CAPTIONS)) capPng[k] = await render(`cap-${k}`, `<div class="cap">${esc(t)}</div>`, true);
const redactPng = await render("redact",
  `<div class="redact" style="left:${REDACT.x}px;top:${REDACT.y}px;width:${REDACT.w}px;height:${REDACT.h}px"></div>
   <div class="redact" style="left:${REDACT.x}px;top:${REDACT.top}px;font-size:${REDACT.size}px;line-height:1;background:transparent">${esc(REDACT.text)}</div>`, true);
await browser.close();

// ---- the cut list --------------------------------------------------------------
const y = (i) => Y[i], s = (i) => S[i];
const R = clips.report ? (new Date(clips.report.stopped) - new Date(clips.report.started)) / 1000 : 0;
const segs = [
  { card: "title" },
  { card: "context" },
  { clip: "your-account", from: y(0).start - 0.1, to: y(0).ink + 2.6, cap: "c1" },
  { clip: "your-account", from: y(1).start, to: y(1).ink + 0.3, speed: 2, cap: "c2" },
  { clip: "your-account", from: y(1).ink + 0.3, to: y(1).ink + 6.8, cap: "c2" },
  // The report command, typed; its printed list is skipped for the report window itself.
  { clip: "your-account", from: y(2).start, to: y(2).ink - 0.1, speed: 2, cap: "c3" },
  ...(R ? [{ clip: "report", from: 0.4, to: Math.min(R - 0.3, 6.2), cap: "c3" }] : []),
  { clip: "your-account", from: y(3).start, to: y(3).ink + 0.3, speed: 2, cap: "c4" },
  { clip: "your-account", from: y(3).ink + 0.3, to: y(3).ink + 7.3, cap: "c4" },
  { card: "setup" },
  { clip: "spare-room", from: s(0).start - 0.1, to: s(0).ink + 2.6, cap: "c5" },
  { clip: "spare-room", from: s(1).start, to: s(1).ink + 0.3, speed: 2, cap: "c6" },
  { clip: "spare-room", from: s(1).ink + 0.3, to: s(1).ink + 7.8, cap: "c6" },
  { clip: "spare-room", from: s(2).start, to: s(2).ink + 0.3, speed: 2, cap: "c7" },
  { clip: "spare-room", from: s(2).ink + 0.3, to: s(2).ink + 7.0, cap: "c7" },
  // verify: the sped-up part stops before its output appears; the held part
  // carries the cover over the real folder name from its first frame.
  { clip: "spare-room", from: s(3).start, to: s(3).ink - 0.12, speed: 2, cap: "c8" },
  { clip: "spare-room", from: s(3).ink + 0.25, to: Math.min(s(3).ink + 8.0, s(3).end), cap: "c8", redact: true },
  { card: "end" },
];

// ---- render segments, then join ----------------------------------------------
const files = [];
const cues = [];
let t = 0;
segs.forEach((g, i) => {
  const out = join(WORK, `seg-${String(i).padStart(2, "0")}.mp4`);
  const enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS), "-an", out];
  let dur;
  if (g.card) {
    const c = CARDS[g.card];
    dur = c.secs;
    run(["-loop", "1", "-t", String(dur), "-i", c.png, "-vf",
      `fps=${FPS},format=yuv420p,fade=t=in:st=0:d=0.35:color=${PAPER.replace("#", "0x")},fade=t=out:st=${dur - 0.35}:d=0.35:color=${PAPER.replace("#", "0x")}`,
      ...enc], g.card);
    cues.push({ start: t, end: t + dur, text: c.vtt });
  } else {
    const speed = g.speed ?? 1;
    dur = (g.to - g.from) / speed;
    // The spare room's window leaves a dark strip below its last row: paint it in the console colour.
    const strip = g.clip === "spare-room" ? `,drawbox=x=0:y=1050:w=${W}:h=${H - 1050}:color=${CONSOLE_BG}:t=fill` : "";
    const inputs = ["-ss", g.from.toFixed(3), "-to", g.to.toFixed(3), "-i", join(RAW, `${g.clip}.mkv`), "-loop", "1", "-i", capPng[g.cap]];
    let fc = `[0:v]setpts=(PTS-STARTPTS)/${speed},fps=${FPS}${strip}[b0]`;
    if (g.redact) {                       // cover first, in the recording's own coordinates
      inputs.push("-loop", "1", "-i", redactPng);
      fc += `;[b0][2:v]overlay=0:0:shortest=1[b1]`;
    } else {
      fc += `;[b0]null[b1]`;
    }
    // Terminals: shrink a little and sit at the top, so captions never cover output.
    // The report: zoom into its top section (headline counts and first findings).
    fc += g.clip === "report"
      ? `;[b1]crop=1138:640:392:40,scale=-2:915,pad=${W}:${H}:(ow-iw)/2:8:color=${PAPER.replace("#", "0x")}[b2]`
      : `;[b1]scale=iw*0.84:-2,pad=${W}:${H}:(ow-iw)/2:8:color=${CONSOLE_BG}[b2]`;
    fc += `;[b2][1:v]overlay=0:0:shortest=1[v]`;
    run([...inputs, "-filter_complex", fc, "-map", "[v]", "-t", dur.toFixed(3), ...enc], `${g.clip} ${g.from.toFixed(2)}`);
    const last = cues[cues.length - 1];
    if (last && last.key === g.cap) last.end = t + dur;
    else cues.push({ start: t, end: t + dur, text: CAPTIONS[g.cap], key: g.cap });
  }
  files.push(out);
  t += dur;
});

const list = join(WORK, "list.txt");
writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"), "utf8");
mkdirSync(dirname(OUT_MP4), { recursive: true });
run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", OUT_MP4], "concat");

const ts = (x) => {
  const ms = Math.round(x * 1000);
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
};
writeFileSync(OUT_VTT, "WEBVTT\n\n" + cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n"), "utf8");
console.log(`Wrote ${OUT_MP4} (${t.toFixed(1)} s, ${segs.length} segments) and ${OUT_VTT} (${cues.length} cues)`);
