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
  let status = 200;
  try { if ((await stat(file)).isDirectory()) file = join(file, "index.html"); } catch { file = join(SITE, "404.html"); status = 404; }
  try { res.writeHead(status, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }); res.end(await readFile(file)); }
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
  page.on("response", (rs) => { if (rs.status() >= 400) problems.push(`@${width}: ${rs.status()} ${new URL(rs.url()).pathname}`); });
  for (const [name, path] of PAGES) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.mouse.wheel(0, 4000); // bring footer links into view so their prefetches run
    await page.waitForTimeout(800);
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

// 2. The playground, keyboard only, at both widths: default run, then passwords.txt
//    in Documents and a .env in C:\dev. Also measures where the Run buttons sit after
//    the jump to #try.
const measured = [];
for (const width of WIDTHS) {
  const height = width <= 390 ? 844 : 900;
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const hosts = new Set();
  page.on("request", (rq) => hosts.add(new URL(rq.url()).host));
  await page.goto(BASE + "/#try", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const runBox = await page.getByRole("button", { name: "Run in my account", exact: true }).boundingBox();
  const spareBox = await page.getByRole("button", { name: "Run in the spare room", exact: true }).boundingBox();
  const bottom = Math.round(Math.max(runBox.y + runBox.height, spareBox.y + spareBox.height));
  measured.push({ width, viewport: height, runButtonsTop: Math.round(runBox.y), runButtonsBottom: bottom,
    limit: width <= 390 ? Math.round(height * 1.5) : height });
  if (width > 390 && bottom > height) problems.push(`playground@${width}: Run buttons end at ${bottom}px, below the ${height}px screen`);
  if (width <= 390 && bottom > height * 1.5) problems.push(`playground@${width}: Run buttons end at ${bottom}px, past 1.5 screens`);
  await page.screenshot({ path: join(SHOTS, `playground-first-${width}.png`) });

  const press = async (name) => { await page.getByRole("button", { name, exact: true }).focus(); await page.keyboard.press("Enter"); };
  const report = (room) => page.getByRole("region", { name: `Report: ${room}` });
  // Element shots: hide the fixed header so it does not cover the top of the element.
  const shot = async (loc, file) => {
    await page.evaluate(() => { document.querySelector("header").style.visibility = "hidden"; });
    await loc.screenshot({ path: join(SHOTS, file) });
    await page.evaluate(() => { document.querySelector("header").style.visibility = ""; });
  };
  const expectText = async (loc, text, what) => {
    const t = await loc.innerText().catch(() => "");
    if (!t.includes(text)) problems.push(`playground@${width}: ${what}: missing "${text}"`);
  };
  const expectNo = async (loc, text, what) => {
    const t = await loc.innerText().catch(() => "");
    if (t.includes(text)) problems.push(`playground@${width}: ${what}: should not show "${text}"`);
  };

  // Arrow keys move between the file tabs.
  const tabs = page.getByRole("tab");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  const sel = await page.evaluate(() => document.activeElement?.getAttribute("aria-selected"));
  if (sel !== "true") problems.push(`playground@${width}: ArrowRight did not move to the next file tab`);

  // After each run the report's big number is on screen; at desktop size the Run buttons stay in view too.
  const inView = async (room) => page.evaluate((r) => {
    const big = document.querySelector(`[data-big-number="${r}"]`).getBoundingClientRect();
    const btn = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Run in my account").getBoundingClientRect();
    const head = document.querySelector("header").getBoundingClientRect().bottom;
    return { big: big.top >= head && big.bottom <= innerHeight, buttons: btn.top >= head && btn.bottom <= innerHeight };
  }, room);
  for (const [name, room] of [["Run in my account", "yours"], ["Run in the spare room", "spare"]]) {
    await press(name);
    await page.waitForTimeout(900); // let the smooth scroll finish
    const v = await inView(room);
    if (!v.big) problems.push(`playground@${width}: after "${name}" the big number is off screen`);
    if (width > 390 && !v.buttons) problems.push(`playground@${width}: after "${name}" the Run buttons left the screen`);
  }
  await expectText(report("Your account"), "visible: 13   blocked: 0", "your account");
  await expectText(report("The spare room"), "visible: 0   blocked: 13", "spare room");
  await expectText(report("The spare room"), "Nothing found that stranger code could take from here", "spare room");
  await expectNo(report("The spare room"), "<project>", "spare room probe");
  await expectText(page.getByRole("region", { name: "Also found by verify" }), String.raw`C:\dev\<project>\.env`, "verify box");
  await expectText(page.locator("#try-run"), "Matches the real tool's recorded run.", "match line");
  await expectText(report("Your account"), "Show all 13", "collapsed probe list");
  await audit(page, "playground-ran", width);
  await shot(page.locator("#try-run"), `playground-ran-${width}.png`);

  // passwords.txt in Documents.
  await page.getByLabel("Kind of file").selectOption("any");
  await page.getByLabel("File name").fill("passwords.txt");
  await page.getByLabel("Where it lives").selectOption("documents");
  await press("Add to the fake laptop");
  // Then the form's default: a .env in C:\dev\take-home, names only.
  await page.getByLabel("Kind of file").selectOption("env");
  await page.getByLabel("Where it lives").selectOption("c_dev");
  await page.getByLabel("Variable names (optional)").fill("STRIPE_SECRET_KEY, PASSWORD = hunter2");
  const formText = await page.locator("form").innerText();
  if (!formText.includes("anything after = was dropped")) problems.push(`playground@${width}: no dropped-value note`);
  await press("Add to the fake laptop");
  const laptop = await page.locator("main").innerText();
  if (laptop.includes("hunter2") && !(await page.getByLabel("Variable names (optional)").inputValue()).includes("hunter2")) {
    problems.push(`playground@${width}: a value was shown`);
  }
  await expectText(page.locator("#try-run"), "The fake laptop changed. Run the code again", "stale note");
  await press("Run in my account");
  await press("Run in the spare room");
  await expectText(report("Your account"), "visible: 14   blocked: 0", "your account after add");
  await expectText(report("Your account"), "Stranger code can read this too. Spare Room's scan doesn't list this kind of file.", "unlisted, yours");
  await expectText(report("Your account"), String.raw`C:\Users\testdev\Documents\passwords.txt`, "unlisted, yours");
  await expectText(report("The spare room"), "visible: 1   blocked: 13", "spare room after add");
  await expectText(report("The spare room"), String.raw`C:\dev\take-home\.env`, "spare room after add");
  await expectText(report("The spare room"), "The spare room can't open anything in your user folder, including files the scan doesn't know about.", "unlisted, spare");
  await expectText(page.locator("#try-run"), "The files you added follow the tool's own rules.", "match line after add");
  if ((await page.locator("main").innerText()).includes("hunter2")) problems.push(`playground@${width}: the value hunter2 appears outside the input`);
  await audit(page, "playground-added", width);
  await shot(page.locator("#try-run"), `playground-added-${width}.png`);

  // Nothing outlives the tab, and Reset puts everything back.
  const stored = await page.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length);
  if (stored) problems.push(`playground@${width}: something was stored (${stored})`);
  await press("Reset");
  if (await page.getByRole("heading", { name: "Files you added" }).count()) problems.push(`playground@${width}: Reset left the added files`);
  if (await report("Your account").count()) problems.push(`playground@${width}: Reset left a report`);
  const foreign = [...hosts].filter((h) => h !== `127.0.0.1:${PORT}`);
  if (foreign.length) problems.push(`playground@${width}: requests to other hosts: ${foreign.join(", ")}`);
  await ctx.close();
}
console.table(measured);

await browser.close();
server.close();
console.table(report);
if (problems.length) {
  console.log("PROBLEMS:\n- " + problems.join("\n- "));
  process.exit(1);
}
console.log(`All checks passed. Screenshots in ${SHOTS}`);
