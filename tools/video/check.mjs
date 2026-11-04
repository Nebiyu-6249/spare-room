// Check the built site (web/out) at 390 px and 1440 px with Playwright and axe.
//   cd tools/video && node check.mjs [screenshot-dir]
// Fails (exit 1) on horizontal scroll, serious/critical axe issues, text under
// 13 px, controls under 44 px, requests to other hosts, or a broken replay.

import { createServer } from "node:http";
import { readFile, mkdir, stat } from "node:fs/promises";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SITE = join(ROOT, "web", "out");
const SHOTS = resolve(process.argv[2] ?? join(ROOT, "tools", "video", "screens"));
const AXE = createRequire(import.meta.url).resolve("axe-core/axe.min.js");
const PORT = 4323;
const PAGES = [["home", "/"], ["results", "/results/"], ["privacy", "/privacy/"], ["download", "/download/"]];
const WIDTHS = [390, 1440];

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2",
  ".json": "application/json", ".txt": "text/plain", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".vtt": "text/vtt" };
const server = createServer(async (req, res) => {
  let file = join(SITE, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); } catch { file = join(SITE, "404.html"); }
  try { res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(PORT, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${PORT}`;
await mkdir(SHOTS, { recursive: true });

const problems = [];
const report = [];
const browser = await chromium.launch();

async function audit(page, name, width) {
  const r = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth > window.innerWidth;
    // Smallest rendered text: HTML text by computed size, SVG text by size times its scale.
    let minPx = 99, minWhere = "";
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest(".sr-only, script, style, noscript")) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      let px = parseFloat(getComputedStyle(el).fontSize);
      const svg = el.closest("svg");
      if (svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width) {
        px = parseFloat(el.getAttribute("font-size") || px) * (svg.getBoundingClientRect().width / svg.viewBox.baseVal.width);
      }
      if (px < minPx) { minPx = px; minWhere = n.textContent.trim().slice(0, 40); }
    }
    const small = (sel) => [...document.querySelectorAll(sel)]
      .filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44)
      .map((e) => `${e.textContent.trim().slice(0, 30)} (${Math.round(e.getBoundingClientRect().height)}px)`);
    return { overflow, minPx: Math.round(minPx * 10) / 10, minWhere, smallNav: small("header a"), smallButtons: small("main button") };
  });
  await page.addScriptTag({ path: AXE });
  const axe = await page.evaluate(async () => {
    const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] } });
    return res.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help }));
  });
  const serious = axe.filter((v) => v.impact === "serious" || v.impact === "critical");
  const row = { page: name, width, overflow: r.overflow, minTextPx: r.minPx, axeSerious: serious.length,
    axeOther: axe.length - serious.length, smallNav: r.smallNav.length, smallButtons: r.smallButtons.length };
  report.push(row);
  if (r.overflow) problems.push(`${name}@${width}: horizontal scroll`);
  if (r.minPx < 13) problems.push(`${name}@${width}: text at ${r.minPx}px ("${r.minWhere}")`);
  if (width <= 390 && r.smallNav.length) problems.push(`${name}@${width}: nav links under 44px: ${r.smallNav.join(", ")}`);
  if (r.smallButtons.length) problems.push(`${name}@${width}: buttons under 44px: ${r.smallButtons.join(", ")}`);
  for (const v of serious) problems.push(`${name}@${width}: axe ${v.impact} ${v.id} x${v.nodes}: ${v.help}`);
  for (const v of axe.filter((x) => !serious.includes(x))) console.log(`  note ${name}@${width}: axe ${v.impact} ${v.id} x${v.nodes}`);
}

// 1. Every page at both widths. Reduced motion, so Home shows the replay's final state.
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const hosts = new Set();
  page.on("request", (rq) => hosts.add(new URL(rq.url()).host));
  for (const [name, path] of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    if (name === "home") {
      const ok = await page.getByText(/13 reachable/).first().isVisible();
      if (!ok) problems.push(`home@${width}: reduced motion did not show the final state`);
    }
    await audit(page, name, width);
    await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`), fullPage: true });
  }
  const foreign = [...hosts].filter((h) => h !== `127.0.0.1:${PORT}`);
  if (foreign.length) problems.push(`@${width}: requests to other hosts: ${foreign.join(", ")}`);
  await ctx.close();
}

// 2. The replay with normal motion, keyboard only.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "no-preference" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const steps = [
    [/^1\. Open the test assignment/, /13 of 13 reachable/, "Recorded in your account", "reachable"],
    [/^2\. Create the spare room/, /Ready in 29\.6 s/, "Recorded while creating the spare room", null],
    [/^3\. Open it again/, /0 of 13 reachable/, "Recorded in the spare room", "blocked"],
  ];
  const svgWords = (w) => page.evaluate((word) =>
    [...document.querySelectorAll("svg text")].filter((t) => t.textContent === word).length, w);
  for (const [label, done, panel, word] of steps) {
    const btn = page.getByRole("button", { name: label });
    await btn.focus();
    await page.keyboard.press("Enter");
    try { await page.getByText(done).first().waitFor({ timeout: 15000 }); }
    catch { problems.push(`replay: "${label}" did not reach "${done}"`); }
    await page.waitForTimeout(700); // let the smooth scroll settle
    const inView = await page.evaluate((title) => {
      const el = [...document.querySelectorAll("div")].find((d) => d.textContent === title);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= window.innerHeight;
    }, panel);
    if (!inView) problems.push(`replay: "${panel}" was not scrolled into view`);
    if (word && (await svgWords(word)) !== 13) problems.push(`replay: expected 13 "${word}" labels in the room after "${label}"`);
  }
  if (!(await page.getByText("The same 13 paths, tried from the spare room: 13 blocked", { exact: true }).isVisible())) {
    problems.push("replay: no 13-blocked line");
  }
  if (!(await page.getByText(/13 reachable/).last().isVisible())) problems.push("replay: no closing line");
  await page.screenshot({ path: join(SHOTS, "home-replay-1440.png"), fullPage: false,
    clip: { x: 0, y: 0, width: 1440, height: 900 } }).catch(() => {});
  await ctx.close();
}

await browser.close();
server.close();
console.table(report);
if (problems.length) {
  console.log("PROBLEMS:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`All checks passed. Screenshots in ${SHOTS}`);
