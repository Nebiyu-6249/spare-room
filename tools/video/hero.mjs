// Build the site's hero image from the tool's own recorded probe output.
//   cd tools/video && node hero.mjs        (run by `npm run build` in web/, as postbuild)
// The 13 "reachable" lines recorded in web/data/twin_run.json are set very
// large in IBM Plex Mono on a tilted plane, with depth-of-field blur and a
// warm-to-teal glow, like a macro photo of a screen. Nothing is invented: the
// paths are the recorded ones with the fake laptop's prefix removed.
// Writes web/public/hero-1920.webp and hero-960.webp, and compresses the video
// poster to web/public/real-demo-poster.webp. Copies all three into web/out
// when a build is there. Uses the Plex Mono that next/font already saved in web/out.

import { chromium } from "playwright";
import ffmpeg from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const WEB = join(ROOT, "web");
const PUB = join(WEB, "public"), OUT = join(WEB, "out");
const WORK = join(ROOT, "tools", "video", "hero-work");
const W = 2400, H = 1350;

const CSS_DIR = join(OUT, "_next", "static", "chunks");
const css = existsSync(CSS_DIR) && readdirSync(CSS_DIR).filter((f) => f.endsWith(".css"))
  .find((f) => readFileSync(join(CSS_DIR, f), "utf8").includes("IBM Plex Mono"));
if (!css) { console.log("hero: no built site with IBM Plex Mono in web/out yet; build once, then run again."); process.exit(0); }

const twin = JSON.parse(readFileSync(join(WEB, "data", "twin_run.json"), "utf8"));
const lines = twin.normal.visible.map((p) => p.replace(/^<fake_laptop>\\C\\Users\\[^\\]+\\/, ""));
if (lines.length !== 13) throw new Error(`expected 13 recorded reachable lines, found ${lines.length}`);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const block = Array.from({ length: 3 }, () => lines).flat()
  .map((p, i) => `<div class="l"><span class="w">reachable</span>  ${esc(p)}${i % 5 === 2 ? "" : ""}</div>`).join("");

// One tilted plane, drawn three times: in focus across a band, softer either side.
const plane = (cls) => `<div class="plane ${cls}"><div class="txt">${block}</div></div>`;
const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${pathToFileURL(join(CSS_DIR, css)).href}">
<style>
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#05090f}
  .scene{position:absolute;inset:0;perspective:1500px;perspective-origin:72% 42%}
  .plane{position:absolute;left:-300px;top:-500px;width:3600px;height:2600px;
    transform:rotateX(52deg) rotateZ(-14deg) translate3d(820px,-40px,0);transform-origin:50% 50%}
  .txt{font-family:"IBM Plex Mono",monospace;font-size:66px;line-height:1.55;font-weight:500;white-space:pre;
    padding:60px 0 0 120px;
    background:linear-gradient(100deg,#ffd08a 0px,#ffaa4c 700px,#f08a3a 1250px,#e7a865 1650px,#56d2c4 2150px,#2fb2d6 2900px,#2fb2d6 6000px);
    -webkit-background-clip:text;background-clip:text;color:transparent}
  .w{font-weight:600}
  .sharp{filter:drop-shadow(0 0 6px rgba(255,190,110,.75)) drop-shadow(0 0 26px rgba(255,150,70,.45));
    -webkit-mask-image:linear-gradient(180deg,transparent 30%,#000 44%,#000 56%,transparent 68%)}
  .soft{filter:blur(5px) drop-shadow(0 0 18px rgba(255,160,80,.5));opacity:.9;
    -webkit-mask-image:linear-gradient(180deg,transparent 12%,#000 28%,#000 40%,transparent 50%,transparent 52%,#000 62%,#000 74%,transparent 86%)}
  .blur{filter:blur(16px) drop-shadow(0 0 30px rgba(80,200,200,.45));opacity:.85;
    -webkit-mask-image:linear-gradient(180deg,#000 0%,#000 16%,transparent 30%,transparent 70%,#000 82%,#000 100%)}
  .glow{position:absolute;inset:0;background:
    radial-gradient(55% 55% at 68% 46%,rgba(255,150,60,.16),transparent 70%),
    radial-gradient(45% 45% at 85% 70%,rgba(40,190,200,.14),transparent 70%)}
  .vig{position:absolute;inset:0;background:radial-gradient(120% 95% at 60% 45%,transparent 45%,rgba(3,6,12,.85) 100%)}
</style></head><body><div class="scene">${plane("blur")}${plane("soft")}${plane("sharp")}</div><div class="glow"></div><div class="vig"></div></body></html>`;

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
const page = join(WORK, "hero.html");
writeFileSync(page, html, "utf8");
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: W, height: H } });
await pg.goto(pathToFileURL(page).href, { waitUntil: "load" });
await pg.evaluate(() => document.fonts.ready);
const png = join(WORK, "hero.png");
await pg.screenshot({ path: png });
await browser.close();

function webp(input, output, width, quality) {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-vf", `scale=${width}:-2:flags=lanczos`, "-c:v", "libwebp", "-quality", String(quality), "-compression_level", "6", output]);
  if (r.status !== 0) throw new Error(`webp failed: ${r.stderr}`);
  return statSync(output).size;
}
const made = [];
made.push(["hero-1920.webp", webp(png, join(PUB, "hero-1920.webp"), 1920, 62)]);
made.push(["hero-960.webp", webp(png, join(PUB, "hero-960.webp"), 960, 60)]);
if (existsSync(join(PUB, "real-demo-poster.jpg"))) {
  made.push(["real-demo-poster.webp", webp(join(PUB, "real-demo-poster.jpg"), join(PUB, "real-demo-poster.webp"), 1280, 70)]);
}
if (existsSync(OUT)) for (const [f] of made) copyFileSync(join(PUB, f), join(OUT, f));
console.log("hero:", made.map(([f, b]) => `${f} ${Math.round(b / 1024)} KB`).join(", "));
