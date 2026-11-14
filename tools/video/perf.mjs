// Lighthouse (mobile preset) on the built site, served the way Netlify serves
// it: from a copy of web/out, with gzip for text files.
//   cd tools/video && node perf.mjs [path=/] [report.json]
// Uses Playwright's Chromium; Lighthouse itself comes from npm via npx.
import { createServer } from "node:http";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const path = process.argv[2] ?? "/";
const report = resolve(process.argv[3] ?? join(tmpdir(), "spare-room-lighthouse.json"));
const site = mkdtempSync(join(tmpdir(), "spare-room-site-"));
cpSync(join(ROOT, "web", "out"), site, { recursive: true });

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".vtt": "text/vtt", ".json": "application/json" };
const server = createServer(async (req, res) => {
  let f = join(site, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try { if ((await stat(f)).isDirectory()) f = join(f, "index.html"); } catch { f = join(site, "404.html"); }
  try {
    let body = await readFile(f);
    const type = TYPES[extname(f)] ?? "application/octet-stream";
    const headers = { "content-type": type, "cache-control": "public, max-age=31536000" };
    if (/text|javascript|json/.test(type) && /gzip/.test(req.headers["accept-encoding"] ?? "")) {
      body = gzipSync(body); headers["content-encoding"] = "gzip";
    }
    res.writeHead(200, headers); res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(4331, "127.0.0.1", r));

// Asynchronous, so this script's own server keeps answering while Lighthouse runs.
const status = await new Promise((done) => {
  const p = spawn("npx", ["--yes", "lighthouse@12.8.2", `http://127.0.0.1:4331${path}`, "--only-categories=performance",
    "--output=json", `--output-path="${report}"`, '--chrome-flags="--headless=new"', "--quiet"],
    { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, shell: true, stdio: ["ignore", "ignore", "inherit"] });
  p.on("close", done);
});
server.close();
rmSync(site, { recursive: true, force: true });
if (status !== 0) process.exit(1);

const lh = JSON.parse(await readFile(report, "utf8"));
const A = lh.audits;
console.log(`performance ${Math.round(lh.categories.performance.score * 100)} (${path})`);
for (const a of ["first-contentful-paint", "largest-contentful-paint", "total-blocking-time", "cumulative-layout-shift", "speed-index"]) {
  console.log(`  ${a}: ${A[a].displayValue}`);
}
console.log("  main thread:", A["mainthread-work-breakdown"].details.items.slice(0, 4)
  .map((i) => `${i.groupLabel} ${Math.round(i.duration)} ms`).join(", "));
