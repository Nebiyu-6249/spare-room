// Screenshots of interactive states the full-page check cannot show:
// the header after scrolling, the "On this page" rail, and the phone menu.
//   cd tools/video && node states.mjs OUT_DIR
import { createServer } from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = join(ROOT, "web", "out");
const OUT = resolve(process.argv[2] ?? "states");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".vtt": "text/vtt" };
const server = createServer(async (req, res) => {
  let f = join(SITE, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try { if ((await stat(f)).isDirectory()) f = join(f, "index.html"); } catch { f = join(SITE, "404.html"); }
  try { res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" }); res.end(await readFile(f)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(4324, "127.0.0.1", r));
await mkdir(OUT, { recursive: true });
const b = await chromium.launch();

const desk = await (await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" })).newPage();
await desk.goto("http://127.0.0.1:4324/", { waitUntil: "networkidle" });
await desk.evaluate(() => document.getElementById("rooms").scrollIntoView());
await desk.waitForTimeout(600);
await desk.screenshot({ path: join(OUT, "home-1440-scrolled-rail.png") });
const railState = await desk.evaluate(() => {
  const nav = document.querySelector('nav[aria-label="On this page"]');
  return { visible: getComputedStyle(nav).visibility, current: nav.querySelector('[aria-current="true"]')?.textContent,
    header: getComputedStyle(document.querySelector("header")).backgroundColor };
});
console.log("rail at #rooms:", JSON.stringify(railState));
await desk.goto("http://127.0.0.1:4324/results/", { waitUntil: "networkidle" });
await desk.mouse.wheel(0, 1200); await desk.waitForTimeout(500);
await desk.screenshot({ path: join(OUT, "results-1440-scrolled.png") });

const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" })).newPage();
await phone.goto("http://127.0.0.1:4324/", { waitUntil: "networkidle" });
await phone.getByRole("button", { name: /Menu/ }).click();
await phone.waitForTimeout(300);
await phone.screenshot({ path: join(OUT, "home-390-menu.png") });
const links = await phone.locator("#site-menu a").evaluateAll((as) => as.map((a) => `${a.textContent} ${Math.round(a.getBoundingClientRect().height)}px`));
console.log("menu links:", links.join(", "));
await phone.keyboard.press("Escape");
console.log("menu after Escape hidden:", await phone.locator("#site-menu").isHidden());
await b.close(); server.close();
