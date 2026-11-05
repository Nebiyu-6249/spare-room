// Edit the raw clips from tools/record_demo.ps1 into one 1:45-2:15 video.
//   cd tools/video && node edit.mjs            render the video
//   cd tools/video && node edit.mjs --redact-test   one frame with the cover, for checking
// Writes web/public/real-demo.mp4 (1920x1080 H.264, captions burned in),
// web/public/real-demo.vtt, web/public/real-demo-poster.jpg (the title card),
// and tools/video/edit-work/timeline.json (segment times, for the narration).
// Cards and captions are rendered with Playwright in the site's own IBM Plex.

import { chromium } from "playwright";
import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAW = join(ROOT, "demo-video", "raw");
const WORK = join(ROOT, "tools", "video", "edit-work");
const PUB = join(ROOT, "web", "public");
const SITE_CSS_DIR = join(ROOT, "web", "out", "_next", "static", "chunks");
const W = 1920, H = 1080, FPS = 30;
const PAPER = "#fafaf7", CONSOLE_BG = "0xF2F2F2";
const REDACT_TEST = process.argv.includes("--redact-test");

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const readJson = (f) => JSON.parse(readFileSync(f, "utf8").replace(/^\uFEFF/, ""));
const clips = Object.fromEntries(readJson(join(RAW, "clips.json")).map((c) => [c.name, c]));
const rel = (clip, iso) => (new Date(iso) - new Date(clips[clip].started)) / 1000;

function run(args, label) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${label}): ${r.stderr}`);
  return r;
}

// ---- calibration -----------------------------------------------------------
// Each console step clears the screen, so row 2 (under the typed command) is
// empty until the command prints. The first frame with dark pixels there is
// when its output really appears (ffmpeg starts ~0.4 s after the logged time).
// The 142-column window records letterboxed: row 1 is centred at y~90, row 2 at y~120.
const ROW2 = "crop=600:20:4:110";
function firstInk(clip, fromSec, toSec) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-ss", String(fromSec), "-to", String(toSec), "-i", join(RAW, `${clip}.mkv`),
    "-vf", `${ROW2},signalstats,metadata=print:key=lavfi.signalstats.YMIN`, "-f", "null", "-"], { encoding: "utf8" });
  let t = null;
  for (const l of (r.stderr || "").split(/\r?\n/)) {
    const pt = l.match(/pts_time:([0-9.]+)/);
    if (pt) t = parseFloat(pt[1]);
    const y = l.match(/YMIN=([0-9.]+)/);
    if (y && t !== null && parseFloat(y[1]) < 120) return fromSec + t;
  }
  return null;
}
function steps(clip, file) {
  return readJson(join(RAW, file)).map((s) => ({ start: rel(clip, s.start), out: rel(clip, s.output_done), end: rel(clip, s.end) }));
}
const O = steps("offline", "timeline-offline.json");
const S = steps("spare-room", "timeline-spare.json");
for (const s of S) s.ink = firstInk("spare-room", s.start + 0.2, s.end) ?? s.out;
// The offline scan keeps the ping result on screen (no clear), so calibrate on
// the ping and shift the scan by the same offset.
O[0].ink = firstInk("offline", O[0].start + 0.2, O[0].end) ?? O[0].out;
const oShift = O[0].ink - O[0].out;
O[1].ink = O[1].out + oShift;
console.log("calibrated:", JSON.stringify({ offline: O.map((s) => +s.ink.toFixed(2)), spare: S.map((s) => +s.ink.toFixed(2)) }));

// VS Code has no step log (the user clicks); these come from the clip's frames:
// trust question until 1.4 s, "allow automatic tasks?" fully shown by 2.4 s,
// Allow clicked ~3.6 s, the task's full result on screen from ~8.3 s.
const V = { trustEnd: 1.4, allowShown: 3.3, resultFrom: 8.4, end: (new Date(clips.vscode.stopped) - new Date(clips.vscode.started)) / 1000 - 0.4 };

// ---- cards and captions --------------------------------------------------------
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
  .redact{position:absolute;background:#F2F2F2;font-family:Consolas,monospace;color:#0c0c0c;white-space:pre}
</style></head><body>${body}</body></html>`;

const CARDS = {
  title: { secs: 5, html: `<div class="card"><div class="rule"></div><h1>Spare Room: run the recruiter's code in a room with nothing in it.</h1></div>`,
    vtt: "Spare Room: run the recruiter's code in a room with nothing in it." },
  context: { secs: 7, html: `<div class="card"><div class="rule"></div>
    <p>Binance's $6.34B loss involved an engineer running a recruiter's coding assignment on his work computer.</p>
    <p class="small">Source: Binance's incident report, as reported by TheStreet (Yahoo Finance), November 3, 2026.</p></div>`,
    vtt: "Binance's $6.34B loss involved an engineer running a recruiter's coding assignment on his work computer." },
  setup: { secs: 6.5, html: `<div class="card"><div class="rule"></div>
    <p>Creating the spare room took <b>29.6 s</b>.</p>
    <p class="small">Recorded earlier. Windows does not allow its permission prompt to be screen-recorded.</p></div>`,
    vtt: "Creating the spare room took 29.6 s (recorded earlier; Windows does not allow its permission prompt to be screen-recorded)." },
  end: { secs: 7.5, html: `<div class="card"><div class="rule"></div>
    <div class="big"><span class="high">13 reachable</span>, then <span class="ok">0</span>.</div>
    <p>Offline. Never reads secret contents. Weaker than a virtual machine.</p>
    <p class="small">spare-room-demo.netlify.app</p></div>`,
    vtt: "13 reachable, then 0. Offline. Never reads secret contents. Weaker than a virtual machine. spare-room-demo.netlify.app" },
};

const CAPTIONS = {
  v1: "A recruiter's test repo, opened in VS Code in your account. VS Code asks whether you trust its authors.",
  v2: "You trust it. VS Code then asks once whether the folder's tasks may run automatically, and you allow it.",
  v3: "The folder's task runs by itself. This one is harmless: it checks 13 fake secrets, and as your account it reaches all 13.",
  o1: "Now with Wi-Fi off. The ping cannot reach the internet.",
  o2: "Spare Room's scan of a bundled fake laptop still completes. It works fully offline and never reads the secrets' contents.",
  s1: "The spare room: a separate, standard Windows account with nothing in it.",
  s2: "Can the coding test run here? Node.js, npm and Git, yes. Python and VS Code need installing for all users.",
  s3: "From the spare room, the 13 fake secrets kept in a copy inside your account's folder: all 13 blocked.",
  s4: "Checked from inside the spare room: 12 of 12 secret locations in your account are out of reach. One .env outside any account folder is still readable by everyone.",
};

// The real project folder name in verify's "Readable by every account" line is
// covered with <project>, in the recording's own coordinates (before scaling).
// The line starts at x=27 (two spaces in), Consolas ~13.5 px per character.
const REDACT = { boxX: 20, boxY: 337, boxW: 700, boxH: 34, x: 27, top: 340, size: 24.6,
  text: "C:\\dev\\<project>\\.env  (environment file)" };

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
const redactPng = await render("redact",
  `<div class="redact" style="left:${REDACT.boxX}px;top:${REDACT.boxY}px;width:${REDACT.boxW}px;height:${REDACT.boxH}px"></div>
   <div class="redact" style="left:${REDACT.x}px;top:${REDACT.top}px;font-size:${REDACT.size}px;line-height:1;background:transparent">${esc(REDACT.text)}</div>`, true);

if (REDACT_TEST) {
  await browser.close();
  const at = S[3].ink + 2;
  const out = join(WORK, "redact-test.png");
  run(["-ss", at.toFixed(2), "-i", join(RAW, "spare-room.mkv"), "-i", redactPng, "-filter_complex",
    "[0:v][1:v]overlay=0:0,crop=760:120:0:290,scale=1520:240", "-frames:v", "1", out], "redact test");
  const orig = join(WORK, "redact-orig.png");
  run(["-ss", at.toFixed(2), "-i", join(RAW, "spare-room.mkv"), "-vf", "crop=760:120:0:290,scale=1520:240", "-frames:v", "1", orig], "orig");
  console.log(`Wrote ${out} and ${orig}`);
  process.exit(0);
}

for (const [k, c] of Object.entries(CARDS)) c.png = await render(`card-${k}`, c.html);
const capPng = {};
for (const [k, t] of Object.entries(CAPTIONS)) capPng[k] = await render(`cap-${k}`, `<div class="cap">${esc(t)}</div>`, true);
await browser.close();

// ---- the cut list ----------------------------------------------------------------
// hold: extra seconds of the last frame (a still screen held longer to be read).
const o = (i) => O[i], s = (i) => S[i];
const segs = [
  { card: "title" },
  { card: "context" },
  { clip: "vscode", from: 0, to: V.trustEnd, hold: 3.2, cap: "v1" },
  { clip: "vscode", from: V.trustEnd + 0.05, to: V.allowShown, hold: 2.6, cap: "v2" },
  { clip: "vscode", from: V.allowShown, to: V.resultFrom, cap: "v3" },
  { clip: "vscode", from: V.resultFrom, to: V.end, hold: 13 - (V.end - V.resultFrom), cap: "v3" },
  { clip: "offline", from: o(0).start - 0.1, to: o(0).ink + 2.6, cap: "o1" },
  { clip: "offline", from: o(1).start, to: o(1).ink + 0.3, speed: 2, cap: "o2" },
  { clip: "offline", from: o(1).ink + 0.3, to: o(1).end - 0.2, hold: 3.5, cap: "o2" },
  { card: "setup" },
  { clip: "spare-room", from: s(0).start - 0.1, to: s(0).ink + 2.6, cap: "s1" },
  { clip: "spare-room", from: s(1).start, to: s(1).ink + 0.3, speed: 2, cap: "s2" },
  { clip: "spare-room", from: s(1).ink + 0.3, to: s(1).end - 0.2, hold: 2, cap: "s2" },
  { clip: "spare-room", from: s(2).start, to: s(2).ink + 0.3, speed: 2, cap: "s3" },
  { clip: "spare-room", from: s(2).ink + 0.3, to: s(2).end - 0.2, hold: 1.5, cap: "s3" },
  // verify: the sped-up part stops before its output appears; the held part
  // carries the cover over the real folder name from its first frame.
  { clip: "spare-room", from: s(3).start, to: s(3).ink - 0.12, speed: 2, cap: "s4" },
  { clip: "spare-room", from: s(3).ink + 0.25, to: s(3).end - 0.2, hold: 5, cap: "s4", redact: true },
  { card: "end" },
];

const files = [], cues = [], timeline = [];
let t = 0;
segs.forEach((g, i) => {
  const out = join(WORK, `seg-${String(i).padStart(2, "0")}.mp4`);
  const enc = ["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS), "-an", out];
  let dur;
  if (g.card) {
    const c = CARDS[g.card];
    dur = c.secs;
    const fade = PAPER.replace("#", "0x");
    run(["-loop", "1", "-t", String(dur), "-i", c.png, "-vf",
      `fps=${FPS},format=yuv420p,fade=t=in:st=0:d=0.35:color=${fade},fade=t=out:st=${dur - 0.35}:d=0.35:color=${fade}`, ...enc], g.card);
    cues.push({ start: t, end: t + dur, text: c.vtt });
    timeline.push({ start: +t.toFixed(2), end: +(t + dur).toFixed(2), what: `card: ${g.card}` });
  } else {
    const speed = g.speed ?? 1, hold = Math.max(0, g.hold ?? 0);
    dur = (g.to - g.from) / speed + hold;
    const inputs = ["-ss", g.from.toFixed(3), "-to", g.to.toFixed(3), "-i", join(RAW, `${g.clip}.mkv`), "-loop", "1", "-i", capPng[g.cap]];
    let fc = `[0:v]setpts=(PTS-STARTPTS)/${speed},fps=${FPS}${hold ? `,tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)}` : ""}[b0]`;
    if (g.redact) {                       // cover first, in the recording's own coordinates
      inputs.push("-loop", "1", "-i", redactPng);
      fc += `;[b0][2:v]overlay=0:0:shortest=1[b1]`;
    } else fc += `;[b0]null[b1]`;
    // Terminals: shrink a little and centre, so captions sit below the text.
    // VS Code: shrink the same way on the paper colour.
    const pad = g.clip === "vscode" ? PAPER.replace("#", "0x") : CONSOLE_BG;
    fc += `;[b1]scale=iw*0.84:-2,pad=${W}:${H}:(ow-iw)/2:8:color=${pad}[b2];[b2][1:v]overlay=0:0:shortest=1[v]`;
    run([...inputs, "-filter_complex", fc, "-map", "[v]", "-t", dur.toFixed(3), ...enc], `${g.clip} ${g.from.toFixed(2)}`);
    const last = cues[cues.length - 1];
    if (last && last.key === g.cap) last.end = t + dur;
    else cues.push({ start: t, end: t + dur, text: CAPTIONS[g.cap], key: g.cap });
    timeline.push({ start: +t.toFixed(2), end: +(t + dur).toFixed(2), what: `${g.clip} ${g.cap}` });
  }
  files.push(out);
  t += dur;
});

const list = join(WORK, "list.txt");
writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"), "utf8");
run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", join(PUB, "real-demo.mp4")], "concat");
// The title card is the poster image.
run(["-i", CARDS.title.png, "-q:v", "3", join(PUB, "real-demo-poster.jpg")], "poster");

const ts = (x) => {
  const ms = Math.round(x * 1000), p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
};
writeFileSync(join(PUB, "real-demo.vtt"), "WEBVTT\n\n" + cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n"), "utf8");
writeFileSync(join(WORK, "timeline.json"), JSON.stringify({ total: +t.toFixed(2), cues: cues.map((c) => ({ start: +c.start.toFixed(2), end: +c.end.toFixed(2), text: c.text })), segments: timeline }, null, 2));
console.log(`Wrote real-demo.mp4 (${t.toFixed(1)} s, ${segs.length} segments), real-demo.vtt (${cues.length} cues) and real-demo-poster.jpg`);
