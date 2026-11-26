// Check the built site (web/out) at 390 px and 1440 px with Playwright and axe.
//   cd tools/video && node check.mjs [screenshot-dir]
// Fails (exit 1) on horizontal scroll, serious/critical axe issues, text under
// 13 px, controls under 44 px, requests to other hosts, or a broken playground.

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
  ".json": "application/json", ".txt": "text/plain", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".vtt": "text/vtt", ".webp": "image/webp", ".svg": "image/svg+xml" };
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
    const wide = overflow ? [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest("[class*=overflow-]"))
      .slice(-3).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)}`) : [];
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
    return { overflow, wide, minPx: Math.round(minPx * 10) / 10, minWhere, smallNav: small("header a"), smallButtons: small("main button") };
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
  if (r.overflow) problems.push(`${name}@${width}: horizontal scroll (${r.wide.join(" | ")})`);
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
      const ok = await page.getByRole("heading", { name: "Try it here, no download" }).isVisible();
      if (!ok) problems.push(`home@${width}: no playground heading`);
    }
    await audit(page, name, width);
    await page.screenshot({ path: join(SHOTS, `${name}-${width}.png`), fullPage: true });
  }
  const foreign = [...hosts].filter((h) => h !== `127.0.0.1:${PORT}`);
  if (foreign.length) problems.push(`@${width}: requests to other hosts: ${foreign.join(", ")}`);
  await ctx.close();
}

// 2. The playground, keyboard only, at both widths: default run, then a .env added to C:\dev.
for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: width <= 390 ? 844 : 900 } });
  const page = await ctx.newPage();
  const hosts = new Set();
  page.on("request", (rq) => hosts.add(new URL(rq.url()).host));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const toTry = () => page.evaluate(() => {
    const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64;
    window.scrollTo(0, document.getElementById("try").getBoundingClientRect().top + window.scrollY - h);
  });
  await toTry();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, `playground-first-${width}.png`) });

  const press = async (name) => { await page.getByRole("button", { name, exact: true }).focus(); await page.keyboard.press("Enter"); };
  const report = (room) => page.getByRole("region", { name: `Report: ${room}` });
  const expectText = async (loc, text, what) => {
    const t = await loc.innerText().catch(() => "");
    if (!t.includes(text)) problems.push(`playground@${width}: ${what}: missing "${text}"`);
  };
  await press("Run in my account");
  await press("Run in the spare room");
  await expectText(report("Your account"), "13 of 13 in your user folder", "your account");
  await expectText(report("Your account"), "visible: 14   blocked: 0", "your account");
  await expectText(report("The spare room"), "visible: 1   blocked: 13", "spare room");
  await expectText(report("The spare room"), "Readable by every account:", "spare room");
  await expectText(page.locator("#try-run"), "Matches the real tool's recorded run.", "match line");
  await audit(page, "playground-ran", width);
  await page.locator("#try-run").screenshot({ path: join(SHOTS, `playground-ran-${width}.png`) });

  // Add a .env to C:\dev, names only.
  await page.getByLabel("Kind of file").selectOption("env");
  await page.getByLabel("Where it lives").selectOption("c_dev");
  await page.getByLabel("Project folder name").fill("client-api");
  await page.getByLabel("Variable names (optional)").fill("STRIPE_SECRET_KEY, DATABASE_URL");
  await press("Add to the fake laptop");
  await expectText(page.locator("#try-run"), "The fake laptop changed. Run the code again", "stale note");
  await press("Run in my account");
  await press("Run in the spare room");
  await expectText(report("Your account"), "visible: 15   blocked: 0", "your account after add");
  await expectText(report("The spare room"), "visible: 2   blocked: 13", "spare room after add");
  await expectText(report("The spare room"), String.raw`C:\dev\client-api\.env`, "spare room after add");
  await expectText(page.locator("#try-run"), "The files you added follow the tool's own rules.", "match line after add");
  await audit(page, "playground-added", width);
  await page.locator("#try-run").screenshot({ path: join(SHOTS, `playground-cdev-${width}.png`) });

  // Nothing outlives the tab, and Reset puts everything back.
  const stored = await page.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length);
  if (stored) problems.push(`playground@${width}: something was stored (${stored})`);
  await press("Reset");
  if (await page.getByText(String.raw`C:\dev\client-api\.env`).count()) problems.push(`playground@${width}: Reset left the added file`);
  if (await report("Your account").count()) problems.push(`playground@${width}: Reset left a report`);
  const foreign = [...hosts].filter((h) => h !== `127.0.0.1:${PORT}`);
  if (foreign.length) problems.push(`playground@${width}: requests to other hosts: ${foreign.join(", ")}`);
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
