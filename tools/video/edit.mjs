// Edit the raw clips from tools/record_demo.ps1 into the demo video.
//   cd tools/video && node edit.mjs                 captions only, or with narration if
//                                                   demo-video/narration-work/lines.json exists
//   cd tools/video && node edit.mjs --narration DIR use DIR/lines.json (from narration.mjs)
//   cd tools/video && node edit.mjs --no-narration  captions only even if lines.json exists
//   cd tools/video && node edit.mjs --out DIR       write the outputs to DIR instead of web/public
//   cd tools/video && node edit.mjs --redact-test   one frame with the cover, for checking
// Writes real-demo.mp4 (1920x1080 H.264, captions burned in, narration if any),
// real-demo.vtt, real-demo-poster.jpg (the end card), and
// tools/video/edit-work/timeline.json (shot and cue times).
// Each shot lasts as long as its narration line plus about 0.5 s: still
// screens are held, waiting is sped up. Without audio, line lengths are
// estimated from the word count (script.mjs).
// Cards and captions are rendered with Playwright in the site's own IBM Plex.

import { chromium } from "playwright";
import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { LINES, estimateSec } from "./script.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAW = join(ROOT, "demo-video", "raw");
const WORK = join(ROOT, "tools", "video", "edit-work");
const SITE_CSS_DIR = join(ROOT, "web", "out", "_next", "static", "chunks");
const W = 1920, H = 1080, FPS = 30;
const PAPER = "#fafaf7", CONSOLE_BG = "0xF2F2F2";
const LEAD = 0.15, TAIL = 0.35;          // silence before and after each line
const MAX_SPEED = 4;
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const REDACT_TEST = process.argv.includes("--redact-test");
const OUT = resolve(arg("--out") ?? join(ROOT, "web", "public"));
const NARR_DIR = resolve(arg("--narration") ?? join(ROOT, "demo-video", "narration-work"));
const narr = !process.argv.includes("--no-narration") && existsSync(join(NARR_DIR, "lines.json"))
  ? JSON.parse(readFileSync(join(NARR_DIR, "lines.json"), "utf8")) : null;
if (narr && narr.lines.length !== LINES.length) throw new Error(`lines.json has ${narr.lines.length} lines, expected ${LINES.length}`);

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
mkdirSync(OUT, { recursive: true });

const readJson = (f) => JSON.parse(readFileSync(f, "utf8").replace(/^\uFEFF/, ""));
const clips = Object.fromEntries(readJson(join(RAW, "clips.json")).map((c) => [c.name, c]));
const rel = (clip, iso) => (new Date(iso) - new Date(clips[clip].started)) / 1000;

function run(args, label) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 26 });
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
    "-vf", `${ROW2},signalstats,metadata=print:key=lavfi.signalstats.YMIN`, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
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
// trust question until 1.4 s, "allow automatic tasks?" fully shown by 3.3 s,
// Allow clicked ~3.6 s, the task's full result on screen from ~8.4 s.
const V = { trustEnd: 1.4, allowShown: 3.3, resultFrom: 8.4, end: (new Date(clips.vscode.stopped) - new Date(clips.vscode.started)) / 1000 - 0.4 };

// ---- page template -------------------------------------------------------------
const css = readdirSync(SITE_CSS_DIR).filter((f) => f.endsWith(".css"))
  .find((f) => readFileSync(join(SITE_CSS_DIR, f), "utf8").includes("IBM Plex Sans"));
if (!css) throw new Error("Build the site first (web/out) so its IBM Plex fonts are available.");
const cssUrl = pathToFileURL(join(SITE_CSS_DIR, css)).href;
const page = (body, transparent) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${cssUrl}">
<style>
  html,body{margin:0;width:${W}px;height:${H}px;background:${transparent ? "transparent" : PAPER};color:#1a1a1a;
    font-family:"IBM Plex Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
  .card{box-sizing:border-box;height:100%;padding:0 200px 150px;display:flex;flex-direction:column;justify-content:center}
  .rule{width:120px;height:6px;background:#1f5c8a;margin-bottom:48px}
  .mark{position:absolute;left:200px;top:80px;font-size:32px;font-weight:600;color:#1f5c8a;letter-spacing:.01em}
  h1{font-size:72px;line-height:1.2;font-weight:600;margin:0;max-width:1500px}
  p{font-size:48px;line-height:1.35;margin:0;max-width:1480px}
  .lead{font-size:56px;line-height:1.3;font-weight:500}
  .small{font-size:30px;color:#5b6573;margin-top:40px}
  .big{font-size:104px;font-weight:600;margin-bottom:28px;line-height:1.1}
  .high{color:#a8001d}.ok{color:#2d6a3e}
  .cap{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);box-sizing:border-box;width:1640px;
    padding:22px 34px;background:rgba(255,255,255,.97);border:1px solid #c9d6e2;border-left:8px solid #1f5c8a;
    border-radius:8px;font-size:36px;line-height:1.35;font-weight:500;box-shadow:0 2px 12px rgba(0,0,0,.08)}
  .redact{position:absolute;background:#F2F2F2;font-family:Consolas,monospace;color:#0c0c0c;white-space:pre}
</style></head><body>${body}</body></html>`;

const CARDS = {
  recruiter: `<div class="mark">Spare Room</div><div class="card"><div class="rule"></div>
    <h1>&ldquo;Thanks for applying. Before our call, please clone this repo and run the coding test.&rdquo;</h1>
    <p class="small">A typical recruiter message. Fictional.</p></div>`,
  binance: `<div class="card"><div class="rule"></div>
    <p>Binance's $6.34B loss involved an engineer running a recruiter's coding assignment on his work computer.</p>
    <p class="small">Source: Binance's incident report, as reported by TheStreet (Yahoo Finance), November 3, 2026.</p></div>`,
  vm: `<div class="card"><div class="rule"></div>
    <p class="lead">A virtual machine is the safe answer. It takes an evening to set up, so for a one-hour test, most people skip it.</p></div>`,
  setup: `<div class="card"><div class="rule"></div>
    <p>Creating the spare room took <b>29.6 s</b>.</p>
    <p class="small">Windows does not allow its permission prompt to be screen-recorded.</p></div>`,
  end: `<div class="card"><div class="rule"></div>
    <div class="big"><span class="high">13 reachable</span>, then <span class="ok">0</span>.</div>
    <p>Before you run a stranger's code, give it a spare room.</p>
    <p class="small">Offline. Never reads a secret's value. Weaker than a virtual machine.</p>
    <p class="small" style="margin-top:16px">spare-room-demo.netlify.app</p></div>`,
};

// ---- the story: 13 shots, one narration line each ---------------------------------
// caps: short caption versions of the line, shown one after another in
// proportion to their words. burn:false keeps a caption out of the picture (the
// card already says it) but still in the .vtt file.
// parts: pieces of a raw clip. speed: playback speed; squeeze: may be sped up
// (up to MAX_SPEED) if the shot runs longer than its line; the last part (or the
// one marked hold) is held on its last frame when the line runs longer.
const o = (i) => O[i], s = (i) => S[i];
const SHOTS = [
  { card: "recruiter", caps: [{ text: "Recruiters and clients often send me a short coding test before the first call. I want the job, so I open it." }] },
  { card: "binance", caps: [{ text: "Binance says its $6.3 billion hack started the same way: an engineer ran a recruiter's coding test on his work laptop." }] },
  { parts: [{ clip: "vscode", from: 0, to: V.trustEnd }],
    caps: [{ text: "A test like that, opened in VS Code on my own account. It asks if I trust the authors. Most of us click yes." }] },
  { parts: [{ clip: "vscode", from: V.trustEnd + 0.05, to: V.allowShown }],
    caps: [{ text: "Then it asks if the folder's tasks can run. I allow it." }] },
  { parts: [{ clip: "vscode", from: V.allowShown, to: V.resultFrom, squeeze: true }, { clip: "vscode", from: V.resultFrom, to: V.end }],
    caps: [{ text: "Something starts by itself. This one is harmless, and the secrets are fake." },
      { text: "In seconds it finds an SSH key, cloud logins, three crypto wallets and saved browser passwords." },
      { text: "13 secrets, all in reach. A real one wouldn't just look." }] },
  { card: "vm", caps: [{ text: "The safe answer is a virtual machine. But setting one up takes an evening, and for a one-hour test, most people skip it.", burn: false }] },
  { card: "setup", caps: [{ text: "So I built Spare Room. It creates a spare room: a second Windows account with nothing in it. On my laptop, that took 30 seconds." }] },
  // whoami: the output row is empty until ink; the part after it carries the
  // cover over the computer name from its first frame.
  { parts: [{ clip: "spare-room", from: s(0).start - 0.1, to: s(0).ink - 0.1 },
      { clip: "spare-room", from: s(0).ink + 0.05, to: s(0).ink + 2.6, redact: "whoami" }],
    caps: [{ text: "Now I'm signed in to the spare room." }] },
  { parts: [{ clip: "spare-room", from: s(1).start, to: s(1).ink + 0.3, speed: 2, squeeze: true },
      { clip: "spare-room", from: s(1).ink + 0.3, to: s(1).end - 0.2, squeeze: true }],
    caps: [{ text: "Can I still do the test here? Node, npm and Git are ready. Python and VS Code need one install, for all users." }] },
  { parts: [{ clip: "spare-room", from: s(2).start, to: s(2).ink + 0.3, speed: 2, squeeze: true },
      { clip: "spare-room", from: s(2).ink + 0.3, to: s(2).end - 0.2, squeeze: true }],
    extraTail: 1.0,                       // a beat of silence after "Blocked. All thirteen."
    caps: [{ text: "Now the same check, against the same 13 secrets. Blocked. All 13." }] },
  // verify: the sped-up part stops before its output appears; the held part
  // carries the cover over the real folder name from its first frame.
  { parts: [{ clip: "spare-room", from: s(3).start, to: s(3).ink - 0.12, speed: 2, squeeze: true },
      { clip: "spare-room", from: s(3).ink + 0.25, to: s(3).end - 0.2, squeeze: true, redact: "verify" }],
    caps: [{ text: "Spare Room also checks from the inside. All 12 secret locations in my account are out of reach." },
      { text: "One .env sits in a shared folder every account can read. Spare Room points it out, so I can move it." }] },
  { parts: [{ clip: "offline", from: o(0).start - 0.1, to: o(0).ink + 2.6 },
      { clip: "offline", from: o(1).start, to: o(1).ink + 0.3, speed: 2, squeeze: true },
      { clip: "offline", from: o(1).ink + 0.3, to: o(1).end - 0.2, squeeze: true }],
    caps: [{ text: "You shouldn't have to trust a security tool blindly." },
      { text: "Spare Room works with the Wi-Fi off, and it never reads a secret's value." }] },
  { card: "end", caps: [{ text: "It's weaker than a virtual machine. It also takes 30 seconds instead of an evening." },
      { text: "13 reachable, then 0. Before you run a stranger's code, give it a spare room.", burn: false }] },
];
if (SHOTS.length !== LINES.length) throw new Error("one shot per narration line");

// Covers, drawn in the recording's own coordinates (before scaling), Consolas
// ~13.5 px per character, rows ~29 px apart (row 2 centred at y~119).
// verify: the real project folder name in "Readable by every account" (row 10,
// two spaces in) shows as <project>. whoami: the computer name shows as <pc>.
const REDACT = {
  verify: { boxX: 20, boxY: 337, boxW: 700, boxH: 34, x: 27, top: 340, text: "C:\\dev\\<project>\\.env  (environment file)" },
  whoami: { boxX: 0, boxY: 104, boxW: 260, boxH: 34, x: 0, top: 107, text: "<pc>\\interview" },
};
const REDACT_SIZE = 24.6;

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
const esc = (x) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const redactPng = {};
for (const [k, r] of Object.entries(REDACT)) redactPng[k] = await render(`redact-${k}`,
  `<div class="redact" style="left:${r.boxX}px;top:${r.boxY}px;width:${r.boxW}px;height:${r.boxH}px"></div>
   <div class="redact" style="left:${r.x}px;top:${r.top}px;font-size:${REDACT_SIZE}px;line-height:1;background:transparent">${esc(r.text)}</div>`, true);

if (REDACT_TEST) {
  await browser.close();
  for (const [k, at, crop] of [["verify", S[3].ink + 2, "crop=760:120:0:290"], ["whoami", S[0].ink + 1, "crop=500:80:0:80"]]) {
    const out = join(WORK, `redact-test-${k}.png`), orig = join(WORK, `redact-orig-${k}.png`);
    run(["-ss", at.toFixed(2), "-i", join(RAW, "spare-room.mkv"), "-i", redactPng[k], "-filter_complex",
      `[0:v][1:v]overlay=0:0,${crop},scale=iw*2:-2`, "-frames:v", "1", out], "redact test");
    run(["-ss", at.toFixed(2), "-i", join(RAW, "spare-room.mkv"), "-vf", `${crop},scale=iw*2:-2`, "-frames:v", "1", orig], "orig");
    console.log(`Wrote ${out} and ${orig}`);
  }
  process.exit(0);
}

const cardPng = {};
for (const [k, html] of Object.entries(CARDS)) cardPng[k] = await render(`card-${k}`, html);
let capN = 0;
for (const shot of SHOTS) for (const c of shot.caps) {
  if (c.burn !== false) c.png = await render(`cap-${String(++capN).padStart(2, "0")}`, `<div class="cap">${esc(c.text)}</div>`, true);
}
await browser.close();

// ---- timing ----------------------------------------------------------------------
const words = (x) => x.split(/\s+/).filter(Boolean).length;
SHOTS.forEach((shot, i) => {
  shot.lineSec = narr ? narr.lines[i].dur : estimateSec(LINES[i]);
  shot.target = LEAD + shot.lineSec + TAIL + (shot.extraTail ?? 0);
  if (!shot.parts) { shot.dur = Math.max(3, shot.target); return; }
  for (const p of shot.parts) { p.speed = p.speed ?? 1; p.hold = 0; }
  const len = (p) => (p.to - p.from) / p.speed;
  const natural = shot.parts.reduce((a, p) => a + len(p), 0);
  if (shot.target > natural) {
    (shot.parts.find((p) => p.holdHere) ?? shot.parts[shot.parts.length - 1]).hold = shot.target - natural;
  } else {
    // Speed up the parts that may be sped up, all by the same factor, so the shot fits its line.
    const sq = shot.parts.filter((p) => p.squeeze);
    const sqLen = sq.reduce((a, p) => a + len(p), 0);
    const need = natural - shot.target;
    if (sqLen > 0) {
      const k = Math.min(sqLen / Math.max(0.05, sqLen - need), ...sq.map((p) => MAX_SPEED / p.speed));
      for (const p of sq) p.speed *= k;
    }
  }
  shot.dur = shot.parts.reduce((a, p) => a + len(p) + p.hold, 0);
});

// ---- picture: one segment per card or clip part, then one concat ---------------------
const files = [], cues = [], timeline = [];
let t = 0, segN = 0;
const enc = (out) => ["-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", String(FPS), "-an", out];
SHOTS.forEach((shot, i) => {
  shot.start = t;
  if (shot.card) {
    const out = join(WORK, `seg-${String(segN++).padStart(2, "0")}.mp4`);
    const d = shot.dur, fade = PAPER.replace("#", "0x");
    run(["-loop", "1", "-t", d.toFixed(3), "-i", cardPng[shot.card], "-vf",
      `fps=${FPS},format=yuv420p,fade=t=in:st=0:d=0.35:color=${fade},fade=t=out:st=${(d - 0.35).toFixed(3)}:d=0.35:color=${fade}`, ...enc(out)], shot.card);
    files.push(out);
  } else {
    for (const p of shot.parts) {
      const out = join(WORK, `seg-${String(segN++).padStart(2, "0")}.mp4`);
      const d = (p.to - p.from) / p.speed + p.hold;
      const inputs = ["-ss", p.from.toFixed(3), "-to", p.to.toFixed(3), "-i", join(RAW, `${p.clip}.mkv`)];
      let fc = `[0:v]setpts=(PTS-STARTPTS)/${p.speed.toFixed(4)},fps=${FPS}${p.hold ? `,tpad=stop_mode=clone:stop_duration=${p.hold.toFixed(3)}` : ""}[b0]`;
      if (p.redact) {                    // cover first, in the recording's own coordinates
        inputs.push("-loop", "1", "-i", redactPng[p.redact]);
        fc += `;[b0][1:v]overlay=0:0:shortest=1[b1]`;
      } else fc += `;[b0]null[b1]`;
      // Shrink a little and centre, so captions sit below the text.
      const pad = p.clip === "vscode" ? PAPER.replace("#", "0x") : CONSOLE_BG;
      fc += `;[b1]scale=iw*0.84:-2,pad=${W}:${H}:(ow-iw)/2:8:color=${pad}[v]`;
      run([...inputs, "-filter_complex", fc, "-map", "[v]", "-t", d.toFixed(3), ...enc(out)], `${p.clip} ${p.from.toFixed(2)}`);
      files.push(out);
    }
  }
  // Captions: spread over the spoken part in proportion to their words; the
  // last one stays to the end of the shot.
  const spoken = LEAD + shot.lineSec;
  const total = shot.caps.reduce((a, c) => a + (c.words ?? words(c.text)), 0);
  let c0 = t;
  shot.caps.forEach((c, j) => {
    const last = j === shot.caps.length - 1;
    const c1 = last ? t + shot.dur : c0 + spoken * (c.words ?? words(c.text)) / total;
    cues.push({ start: c0, end: c1, text: c.text, png: c.png });
    c0 = c1;
  });
  timeline.push({ shot: i + 1, start: +t.toFixed(2), end: +(t + shot.dur).toFixed(2), line: +shot.lineSec.toFixed(2),
    what: shot.card ? `card: ${shot.card}` : shot.parts.map((p) => `${p.clip} x${p.speed.toFixed(2)}${p.hold ? ` hold ${p.hold.toFixed(1)}` : ""}`).join(", ") });
  t += shot.dur;
});
const TOTAL = t;
const list = join(WORK, "list.txt");
writeFileSync(list, files.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"), "utf8");
const picture = join(WORK, "picture.mp4");
run(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", picture], "concat");

// ---- sound: each line at the start of its shot, then -16 LUFS ------------------------
let voice = null;
if (narr) {
  const mixed = join(WORK, "voice-mixed.wav");
  const ins = [], fcs = [];
  narr.lines.forEach((l, i) => {
    ins.push("-i", l.file);
    const ms = Math.round((SHOTS[i].start + LEAD) * 1000);
    fcs.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=mono,adelay=${ms}:all=1[a${i}]`);
  });
  fcs.push(`${narr.lines.map((_, i) => `[a${i}]`).join("")}amix=inputs=${narr.lines.length}:normalize=0:dropout_transition=0,apad=whole_dur=${TOTAL.toFixed(3)}[m]`);
  run([...ins, "-filter_complex", fcs.join(";"), "-map", "[m]", "-t", TOTAL.toFixed(3), mixed], "mix");
  // Two-pass loudness normalisation to -16 LUFS integrated, -1.5 dBTP.
  const m = spawnSync(ffmpeg, ["-hide_banner", "-i", mixed, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" });
  const j = JSON.parse(m.stderr.slice(m.stderr.lastIndexOf("{"), m.stderr.lastIndexOf("}") + 1));
  voice = join(WORK, "voice.wav");
  run(["-i", mixed, "-af", `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,aresample=48000`,
    "-ar", "48000", voice], "loudnorm");
  console.log(`narration: measured ${j.input_i} LUFS, normalised to -16`);
}

// ---- final: burn the captions, add the voice ---------------------------------------------
const burned = cues.filter((c) => c.png);
const ins = ["-i", picture, ...burned.flatMap((c) => ["-i", c.png])];
if (voice) ins.push("-i", voice);
let fc = "", prev = "0:v";
burned.forEach((c, k) => {
  const outL = k === burned.length - 1 ? "v" : `c${k}`;
  fc += `${fc ? ";" : ""}[${prev}][${k + 1}:v]overlay=0:0:enable='between(t,${c.start.toFixed(3)},${(c.end - 0.001).toFixed(3)})'[${outL}]`;
  prev = outL;
});
const audioMap = voice ? ["-map", `${burned.length + 1}:a`, "-c:a", "aac", "-b:a", "160k"] : ["-an"];
run([...ins, "-filter_complex", fc, "-map", "[v]", ...audioMap, "-c:v", "libx264", "-preset", "medium", "-crf", "20",
  "-pix_fmt", "yuv420p", "-r", String(FPS), "-t", TOTAL.toFixed(3), "-movflags", "+faststart", join(OUT, "real-demo.mp4")], "final");
// The end card is the poster image.
run(["-i", cardPng.end, "-q:v", "3", join(OUT, "real-demo-poster.jpg")], "poster");

const ts = (x) => {
  const ms = Math.round(x * 1000), p = (n, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}.${p(ms % 1000, 3)}`;
};
writeFileSync(join(OUT, "real-demo.vtt"), "WEBVTT\n\n" + cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n"), "utf8");
writeFileSync(join(WORK, "timeline.json"), JSON.stringify({ total: +TOTAL.toFixed(2), narration: narr ? narr.input : null,
  shots: timeline, cues: cues.map((c) => ({ start: +c.start.toFixed(2), end: +c.end.toFixed(2), text: c.text, burned: !!c.png })) }, null, 2));
console.log(`Wrote real-demo.mp4 (${TOTAL.toFixed(1)} s, ${SHOTS.length} shots, ${narr ? "with narration" : "captions only"}), real-demo.vtt (${cues.length} cues) and real-demo-poster.jpg to ${OUT}`);
