// Split the user's narration recording into the 13 lines of script.mjs.
//   cd tools/video && node narration.mjs [--input FILE] [--out DIR]
// Default input: demo-video/narration.m4a (or .wav / .mp3).
// Default output: demo-video/narration-work/ (line-01.wav ... and lines.json).
// The recording has about 2 s of silence between lines; a re-read line is
// preceded by the word "again". Steps:
//   1. light noise reduction (afftdn), high-pass at 80 Hz, 48 kHz mono;
//   2. split at silences of 1.3 s or more;
//   3. a very short piece (under 1.0 s) is an "again": it and the take before
//      it are dropped, so the last take of a line is kept;
//   4. exactly 13 pieces must remain, or nothing is written. A map.json in the
//      output folder ({"keep": [piece numbers]}) overrides step 3.
// Loudness (-16 LUFS) is set later, on the finished narration track, by edit.mjs.

import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LINES, estimateSec } from "./script.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const input = arg("--input") ?? ["m4a", "wav", "mp3"].map((e) => join(ROOT, "demo-video", `narration.${e}`)).find(existsSync);
if (!input || !existsSync(input)) { console.error("No narration file found (demo-video/narration.m4a)."); process.exit(1); }
const OUT = resolve(arg("--out") ?? join(ROOT, "demo-video", "narration-work"));
mkdirSync(OUT, { recursive: true });
for (const f of ["lines.json"]) rmSync(join(OUT, f), { force: true });

const SILENCE_DB = -40, SILENCE_S = 1.3, AGAIN_MAX_S = 1.0, CLICK_S = 0.25;

function ff(args, label) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${label}): ${r.stderr}`);
  return r.stderr || "";
}

const clean = join(OUT, "clean.wav");
ff(["-loglevel", "error", "-i", input, "-ac", "1", "-ar", "48000", "-af", "highpass=f=80,afftdn=nr=12:nf=-45", clean], "clean");
const total = parseFloat(ff(["-i", clean, "-f", "null", "-"], "probe").match(/time=(\d+):(\d+):([\d.]+)/g).pop()
  .replace("time=", "").split(":").reduce((a, x) => a * 60 + parseFloat(x), 0));

// Speech pieces are the gaps between detected silences.
const log = ff(["-i", clean, "-af", `silencedetect=noise=${SILENCE_DB}dB:d=${SILENCE_S}`, "-f", "null", "-"], "silence");
const sil = [];
let open = null;
for (const l of log.split(/\r?\n/)) {
  const s = l.match(/silence_start: ([\d.]+)/); if (s) open = parseFloat(s[1]);
  const e = l.match(/silence_end: ([\d.]+)/); if (e) { sil.push([open ?? 0, parseFloat(e[1])]); open = null; }
}
if (open !== null) sil.push([open, total]);
const pieces = [];
let cur = 0;
for (const [a, b] of sil) { if (a - cur > CLICK_S) pieces.push({ start: cur, end: a }); cur = b; }
if (total - cur > CLICK_S) pieces.push({ start: cur, end: total });
pieces.forEach((p, i) => { p.n = i + 1; p.dur = +(p.end - p.start).toFixed(2); });

let keep;
const mapFile = join(OUT, "map.json");
if (existsSync(mapFile)) {
  keep = JSON.parse(readFileSync(mapFile, "utf8")).keep.map((n) => pieces[n - 1]);
} else {
  keep = [];
  for (const p of pieces) {
    if (p.dur < AGAIN_MAX_S) { p.again = true; keep.pop(); } else keep.push(p);
  }
}

console.log("pieces (s):", pieces.map((p) => `${p.n}:${p.dur}${p.again ? " again" : ""}`).join("  "));
if (keep.length !== LINES.length) {
  console.error(`Expected ${LINES.length} lines after removing "again" takes, found ${keep.length}.`);
  console.error(`Write ${mapFile} as {"keep": [piece numbers in line order]} and run again.`);
  process.exit(2);
}

const lines = keep.map((p, i) => {
  const file = join(OUT, `line-${String(i + 1).padStart(2, "0")}.wav`);
  const a = Math.max(0, p.start - 0.06), b = Math.min(total, p.end + 0.12), d = b - a;
  ff(["-loglevel", "error", "-ss", a.toFixed(3), "-to", b.toFixed(3), "-i", clean,
    "-af", `afade=t=in:d=0.03,afade=t=out:st=${(d - 0.05).toFixed(3)}:d=0.05`, file], `line ${i + 1}`);
  const est = estimateSec(LINES[i]);
  const ratio = d / est;
  if (ratio < 0.5 || ratio > 2) console.warn(`line ${i + 1}: ${d.toFixed(1)} s, expected about ${est.toFixed(1)} s - check the split`);
  return { line: i + 1, file, dur: +d.toFixed(3), piece: p.n };
});
writeFileSync(join(OUT, "lines.json"), JSON.stringify({ input, lines }, null, 2));
console.log(`Wrote ${lines.length} lines to ${OUT}: ${lines.map((l) => l.dur.toFixed(1)).join(", ")} s`);
