// The playground's engine: Spare Room's rules, simulated on the fake laptop.
//
// Every rule comes from data/rules.json, which packaging/export_rules.py
// generates from the Python source before each build. Nothing here invents a
// location, a file name, a severity or a finding text. Reachability is limited
// to the cases the real tool has recorded (see REACH); anything else is
// "unknown" and the page says "The real tool would check this".
//
// Pure functions, no imports, no I/O: the page calls them in the browser and
// tests/playground.test.ts calls them under Node.

// ---- shape of data/rules.json ----------------------------------------------

export type Severity = "high" | "medium" | "info";
export type Spec = {
  id: string; category: string; check: string; rel: string[] | null;
  kind: string; severity: Severity; reason: string; fix: string; source_ref: string;
};
export type TrapFile = { path: string; text: string };
export type Rules = {
  tool_version: string;
  categories: string[];
  severities: Severity[];
  specs: Spec[];
  npmrc_token_key_suffixes: string[];
  claude_files: { rel: string[]; kind: string; severity: Severity }[];
  browsers: { name: string; user_data: string[] }[];
  browser_profiles: string[];
  browser_local_state: { file: string; kind: string; severity: Severity; reason: string };
  browser_store_files: { file: string; kind: string; severity: Severity; reason: string }[];
  browser_fix: string;
  browser_source_ref: string;
  wallet_extensions: { id: string; name: string }[];
  wallet_ext: { kind: string; severity: Severity; reason: string; fix: string; source_ref: string };
  env: { filenames: string[]; skip_dirs: string[]; max_depth: number; kind: string; severity: Severity;
    reason: string; fix: string; source_ref: string };
  fake_laptop: { home_user: string; targets: { category: string; rel: string }[] };
  traps: { id: string; trigger: string; description: string; folder: string; files: TrapFile[] }[];
};

/** What the scan says about a file: the same fields as a Finding, minus id and path. */
export type Match = {
  category: string; kind: string; severity: Severity; reason: string; fix: string; source_ref: string | null;
};
export type Classification =
  | { found: true; match: Match }
  | { found: false; hint: string | null };

// ---- the fake laptop -------------------------------------------------------

export const HOME_PREFIX = (r: Rules) => `C:\\Users\\${r.fake_laptop.home_user}\\`;

export type Origin = "fake_laptop" | "verify" | "added";
export type Item = {
  id: string;
  path: string;          // Windows path on the fake laptop, e.g. C:\Users\testdev\.ssh\id_rsa
  origin: Origin;
  label?: string;        // short name for the 13 from the video
  envNames?: string[];   // .env variable names typed by the person; never values
  match?: Match;         // the recorded scan's own finding, for the fake laptop's files
};

/** Where a path lives, which is what decides who can read it. */
export type Place = "profile" | "public" | "c_dev" | "c_other" | "other_drive";

export function placeOf(r: Rules, path: string): Place {
  const p = path.toLowerCase();
  if (p.startsWith(HOME_PREFIX(r).toLowerCase())) return "profile";
  if (p.startsWith("c:\\users\\public\\")) return "public";
  if (p.startsWith("c:\\dev\\")) return "c_dev";
  if (p.startsWith("c:\\")) return "c_other";
  return "other_drive";
}

// ---- who can read what: only recorded cases --------------------------------

export type Room = "yours" | "spare";
export type Reach = "visible" | "blocked" | "unknown";

/**
 * Backed cases only.
 *  profile: recorded twin run, 13 of 13 visible from your account and 13 of 13
 *           blocked from the spare room, plus verify (every known secret
 *           location in your folder out of reach from the spare room).
 *  c_dev:   recorded verify, run inside the spare room, could read a .env in
 *           C:\dev, so every account can; your own account can too.
 * Public, other folders at the top of C: and other drives were not recorded
 * and no Microsoft page found states their default permissions: unknown.
 */
export const REACH: Record<Place, Record<Room, Reach>> = {
  profile: { yours: "visible", spare: "blocked" },
  c_dev: { yours: "visible", spare: "visible" },
  public: { yours: "unknown", spare: "unknown" },
  c_other: { yours: "unknown", spare: "unknown" },
  other_drive: { yours: "unknown", spare: "unknown" },
};

export const REACH_EVIDENCE: Record<Place, string> = {
  profile: "Recorded: from the spare room, Windows denied access to every file in your account folder.",
  c_dev: "Recorded: verify, run inside the spare room, could read a .env in C:\\dev.",
  public: "Not recorded yet. The real tool would check this folder's permissions.",
  c_other: "Not recorded yet. The real tool would check this folder's permissions.",
  other_drive: "Not recorded yet. The real tool would check this drive's permissions.",
};

// ---- classification: the scanner's rules -----------------------------------

const split = (path: string) => path.split("\\").filter(Boolean);
const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const startsWithParts = (parts: string[], prefix: string[]) =>
  prefix.length <= parts.length && prefix.every((p, i) => eq(p, parts[i]));
const sameParts = (a: string[], b: string[]) => a.length === b.length && startsWithParts(a, b);

function homeParts(r: Rules, path: string): string[] | null {
  return placeOf(r, path) === "profile" ? split(path.slice(HOME_PREFIX(r).length)) : null;
}

/** The env hunt's own walk: every fixed drive, skipping ENV_SKIP_DIRS, bounded by ENV_MAX_DEPTH. */
function envHuntFinds(r: Rules, path: string): boolean {
  const parts = split(path);           // ["C:", "dev", "app", ".env"]
  const name = parts[parts.length - 1];
  if (!r.env.filenames.includes(name)) return false;   // exact, as in Python's `fname in ENV_FILENAMES`
  const dirs = parts.slice(1, -1);
  if (dirs.some((d) => r.env.skip_dirs.includes(d))) return false;
  // os.walk depth of the folder holding the file is (number of folders - 1); the
  // walk stops descending at max_depth, so folders deeper than that are never listed.
  return dirs.length - 1 <= r.env.max_depth;
}

/** Key names only (the part before "="), as scanner._check_npmrc reads them. */
export function npmrcHasToken(r: Rules, keyNames: string[]): boolean {
  return keyNames.some((k) => r.npmrc_token_key_suffixes.some((s) => k.trim().toLowerCase().endsWith(s)));
}

export function classify(r: Rules, path: string, keyNames: string[] = []): Classification {
  const hp = homeParts(r, path);
  if (hp) {
    for (const c of r.claude_files) {
      if (sameParts(hp, c.rel)) {
        const spec = r.specs.find((s) => s.check === "claude_creds")!;
        return { found: true, match: { category: spec.category, kind: c.kind, severity: c.severity,
          reason: spec.reason, fix: spec.fix, source_ref: spec.source_ref } };
      }
    }
    for (const s of r.specs) {
      if (!s.rel || s.check === "claude_creds" || !startsWithParts(hp, s.rel)) continue;
      // A spec names a file or a folder; a hit is the path itself or something inside it.
      let { kind, severity, reason } = s;
      if (s.check === "npmrc_token" && !npmrcHasToken(r, keyNames)) {
        kind = ".npmrc (no auth-token key)"; severity = "info";
        reason = "This .npmrc has no auth-token line, but it is still read by install scripts.";
      } else if (s.check === "npmrc_token") {
        kind = "npm auth token present";
      }
      return { found: true, match: { category: s.category, kind, severity, reason, fix: s.fix, source_ref: s.source_ref } };
    }
    for (const b of r.browsers) {
      if (!startsWithParts(hp, b.user_data)) continue;
      const rest = hp.slice(b.user_data.length);
      const ls = r.browser_local_state;
      if (rest.length === 1 && eq(rest[0], ls.file)) {
        return { found: true, match: { category: "browser_store", kind: `${b.name}: ${ls.kind}`, severity: ls.severity,
          reason: ls.reason, fix: r.browser_fix, source_ref: r.browser_source_ref } };
      }
      if (rest.length >= 2 && r.browser_profiles.some((p) => eq(p, rest[0]))) {
        const store = r.browser_store_files.find((f) => rest.length === 2 && eq(f.file, rest[1]));
        if (store) {
          return { found: true, match: { category: "browser_store", kind: `${b.name}: ${store.kind}`,
            severity: store.severity, reason: store.reason, fix: r.browser_fix, source_ref: r.browser_source_ref } };
        }
        const ext = rest.length >= 3 && eq(rest[1], "Local Extension Settings")
          ? r.wallet_extensions.find((w) => w.id === rest[2]) : undefined;
        if (ext) {
          const w = r.wallet_ext;
          return { found: true, match: { category: "wallet_extension",
            kind: w.kind.replace("{name}", ext.name).replace("{browser}", b.name), severity: w.severity,
            reason: w.reason.replace("{name}", ext.name), fix: w.fix, source_ref: w.source_ref } };
        }
      }
    }
  }
  if (envHuntFinds(r, path)) {
    const e = r.env;
    return { found: true, match: { category: "env_file", kind: e.kind, severity: e.severity, reason: e.reason,
      fix: e.fix, source_ref: e.source_ref } };
  }
  return { found: false, hint: hintFor(r, path) };
}

/** If the file name is one the rules know, say where the tool looks for it instead. */
function hintFor(r: Rules, path: string): string | null {
  const parts = split(path);
  const name = parts[parts.length - 1];
  const home = HOME_PREFIX(r);
  if (r.env.filenames.includes(name)) {
    const skipped = parts.slice(1, -1).find((d) => r.env.skip_dirs.includes(d));
    return skipped ? `The .env search skips folders named ${skipped}.` : null;
  }
  if (/^\.env/i.test(name)) return `The .env search looks only for ${r.env.filenames.join(", ")}.`;
  const known = [
    ...r.specs.filter((s) => s.rel && s.check !== "claude_creds").map((s) => s.rel!),
    ...r.claude_files.map((c) => c.rel),
  ].find((rel) => eq(rel[rel.length - 1], name));
  if (known) return `It looks for ${name} only at ${home}${known.join("\\")}.`;
  const store = r.browser_store_files.find((f) => eq(f.file, name));
  if (store) return `It looks for ${name} only inside a browser profile folder in your account.`;
  const ext = r.wallet_extensions.find((w) => w.id === name);
  if (ext) return `It looks for ${ext.name}'s storage only inside a browser profile folder in your account.`;
  return null;
}

// ---- the probe, simulated --------------------------------------------------

export type Line = { item: Item; match: Match };
export type RoomReport = {
  room: Room;
  checked: number;                 // paths the probe was given (the ones the rules recognise)
  visible: Line[];                 // present and readable from this room
  blocked: Line[];                 // present, access denied
  unknown: Line[];                 // not a recorded case: "The real tool would check this"
  notLooked: { item: Item; hint: string | null }[];  // outside your folder: "Spare Room doesn't look for this kind of file"
  // In your user folder but not a kind the scan lists. Not part of the probe's list,
  // but the folder's recorded permissions still apply: readable from your account,
  // blocked from the spare room (REACH.profile).
  unlisted: { item: Item; hint: string | null; reach: Reach }[];
  inProfile: { visible: number; blocked: number; total: number };
  shared: Line[];                  // visible and outside any account folder: verify's "Readable by every account"
};

export function describe(r: Rules, item: Item): Classification {
  return item.match ? { found: true, match: item.match } : classify(r, item.path, item.envNames);
}

export function runProbe(r: Rules, items: Item[], room: Room): RoomReport {
  const rep: RoomReport = { room, checked: 0, visible: [], blocked: [], unknown: [], notLooked: [], unlisted: [],
    inProfile: { visible: 0, blocked: 0, total: 0 }, shared: [] };
  for (const item of items) {
    const c = describe(r, item);
    if (!c.found) {
      if (placeOf(r, item.path) === "profile") rep.unlisted.push({ item, hint: c.hint, reach: REACH.profile[room] });
      else rep.notLooked.push({ item, hint: c.hint });
      continue;
    }
    rep.checked += 1;
    const place = placeOf(r, item.path);
    const reach = REACH[place][room];
    const line = { item, match: c.match };
    rep[reach].push(line);
    if (place === "profile") {
      rep.inProfile.total += 1;
      if (reach === "visible") rep.inProfile.visible += 1;
      if (reach === "blocked") rep.inProfile.blocked += 1;
    } else if (reach === "visible") {
      rep.shared.push(line);
    }
  }
  return rep;
}

// ---- the default fake laptop -----------------------------------------------

/** The 13 fake secrets from the twin run, in the recorded order. */
export function defaultItems(r: Rules, names: Record<string, string>, recordedFindings: (Match & { path: string })[]): Item[] {
  const home = HOME_PREFIX(r);
  const items: Item[] = r.fake_laptop.targets.map((t, i) => {
    const path = home + t.rel.replace(/\//g, "\\");
    // The recorded scan's finding for this file: the file itself, or the folder it sits in.
    const rec = recordedFindings
      .filter((f) => path.toLowerCase() === f.path.toLowerCase() || path.toLowerCase().startsWith(f.path.toLowerCase() + "\\"))
      .sort((a, b) => b.path.length - a.path.length)[0];
    const match = rec ? { category: rec.category, kind: rec.kind, severity: rec.severity, reason: rec.reason,
      fix: rec.fix, source_ref: rec.source_ref } : undefined;
    return { id: `fake-${i}`, path, origin: "fake_laptop", label: names[t.rel] ?? t.rel, match };
  });
  return items;
}

/** What verify, run inside the spare room, recorded as readable by every account. */
export function verifyFindings(r: Rules, paths: string[]): Line[] {
  return paths.map((path, i) => {
    const c = classify(r, path);
    if (!c.found) throw new Error(`verify recorded a path the rules do not recognise: ${path}`);
    return { item: { id: `verify-${i}`, path, origin: "verify" as const }, match: c.match };
  });
}

// ---- what a person can add -------------------------------------------------

export type AddType = "env" | "ssh" | "cloud" | "wallet" | "browser" | "any";
export type AddWhere = "usual" | "desktop" | "documents" | "project" | "public" | "c_dev" | "d_work";

export type Variant = { id: string; label: string; rel: string[] };

/** The variants of each type, straight from the rules (never invented). */
export function variants(r: Rules, type: AddType): Variant[] {
  const fromSpecs = (pred: (s: Spec) => boolean) =>
    r.specs.filter((s) => s.rel && pred(s)).map((s) => ({ id: s.id, label: `${s.kind} (${s.rel!.join("\\")})`, rel: s.rel! }));
  if (type === "ssh") return fromSpecs((s) => s.check === "private_key");
  if (type === "cloud") return fromSpecs((s) => s.category === "cloud");
  if (type === "wallet") {
    const chrome = r.browsers[0];
    return [
      ...fromSpecs((s) => s.category === "desktop_wallet"),
      ...r.wallet_extensions.map((w) => ({ id: `ext-${w.id}`, label: `${w.name} (browser extension, ${chrome.name})`,
        rel: [...chrome.user_data, r.browser_profiles[0], "Local Extension Settings", w.id] })),
    ];
  }
  if (type === "browser") {
    const login = r.browser_store_files[0];
    return r.browsers.map((b) => ({ id: `login-${b.name}`, label: `${b.name}: ${login.kind}`,
      rel: [...b.user_data, r.browser_profiles[0], login.file] }));
  }
  return [];
}

/** Folder names and file names: no path separators or characters Windows forbids. */
export function cleanName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * .env variable names only, never values. Entries are split on commas,
 * semicolons and line breaks only; in each, only the text before the first "="
 * is kept, and the entry is dropped unless that is a single variable name.
 * So "PASSWORD = hunter2" keeps PASSWORD and "KEY=abc def" keeps KEY.
 */
export function cleanEnvNames(raw: string): { names: string[]; droppedValues: boolean; droppedEntries: boolean } {
  let droppedValues = false;
  let droppedEntries = false;
  const names: string[] = [];
  for (const entry of raw.split(/[,;\r\n]+/)) {
    if (!entry.trim()) continue;
    const eq = entry.indexOf("=");
    if (eq >= 0) droppedValues = true;
    const name = (eq >= 0 ? entry.slice(0, eq) : entry).trim();
    if (/^[A-Za-z_][A-Za-z0-9_.]*$/.test(name)) names.push(name);
    else droppedEntries = true;
  }
  return { names: [...new Set(names)].slice(0, 20), droppedValues, droppedEntries };
}

export function buildPath(r: Rules, o: { type: AddType; where: AddWhere; variant?: Variant; fileName: string;
  project: string }): string {
  const home = HOME_PREFIX(r).slice(0, -1);
  const project = cleanName(o.project) || "take-home";
  if (o.where === "usual" && o.variant) return [home, ...o.variant.rel].join("\\");
  const name = o.variant ? o.variant.rel[o.variant.rel.length - 1] : cleanName(o.fileName);
  const folder = {
    usual: home, desktop: `${home}\\Desktop`, documents: `${home}\\Documents`, project: `${home}\\projects\\${project}`,
    public: "C:\\Users\\Public\\Documents", c_dev: `C:\\dev\\${project}`, d_work: "D:\\work",
  }[o.where];
  return `${folder}\\${name}`;
}
