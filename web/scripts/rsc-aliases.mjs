// Next 16's static export writes a page's prefetch data as
//   out/results/__next.results/__PAGE__.txt
// but its client asks for
//   out/results/__next.results.__PAGE__.txt
// so every link prefetch 404s on any static host. Copy each file inside a
// `__next.*` folder to the dotted name the client requests. Local files only.
import { readdir, copyFile, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "out");
let made = 0;

async function filesUnder(dir, rel = "") {
  const out = [];
  for (const e of await readdir(join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await filesUnder(dir, r)));
    else out.push(r);
  }
  return out;
}

async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const full = join(dir, e.name);
    if (e.name.startsWith("__next.")) {
      for (const rel of await filesUnder(full)) {
        const alias = join(dir, `${e.name}.${rel.replace(/\//g, ".")}`);
        try { await stat(alias); } catch { await copyFile(join(full, rel), alias); made += 1; }
      }
    } else {
      await walk(full);
    }
  }
}

await walk(OUT);
console.log(`rsc-aliases: ${made} prefetch file${made === 1 ? "" : "s"} copied to the names the client requests`);
