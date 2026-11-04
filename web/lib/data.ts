// Recorded output from the real tool, exported by packaging/export_recorded.py
// (and the setup transcript copied from the test run). Paths are redacted
// there; nothing here is generated in the browser.
import scanDemo from "@/data/scan_demo.json";
import twinRun from "@/data/twin_run.json";
import account from "@/data/account.json";
import coverage from "@/data/coverage.json";
import meta from "@/data/meta.json";
import setupTranscript from "@/data/setup_transcript.json";

export const APP_NAME = "Spare Room";
export const REPO_URL = "https://github.com/Nebiyu-6249/spare-room";
export const RELEASE_URL = `${REPO_URL}/releases/latest`;
export const BINANCE_URL = "https://finance.yahoo.com/markets/crypto/articles/binance-says-6-3-billion-181834232.html";

export type Severity = "high" | "medium" | "info";

export type Finding = {
  id: string;
  category: string;
  path: string;
  kind: string;
  severity: Severity;
  reason: string;
  fix: string;
  source_ref: string | null;
};

export const CATEGORY_LABELS: Record<string, string> = {
  ssh: "SSH keys",
  cloud: "Cloud credentials",
  token: "Developer tokens",
  env_file: "Environment files (.env)",
  wallet_extension: "Crypto wallet extensions",
  desktop_wallet: "Desktop crypto wallets",
  browser_store: "Browser password stores",
  ai_tool: "AI tool sign-ins",
  shell_history: "Shell history",
  editor_setting: "Editor settings",
};

// The fake secrets in the two-room picture, grouped by kind.
export type Kind = "keys" | "cloud" | "wallets" | "browser" | "ai" | "shell" | "env";
export const KIND_OF: Record<string, Kind> = {
  ssh: "keys",
  token: "keys",
  cloud: "cloud",
  desktop_wallet: "wallets",
  wallet_extension: "wallets",
  browser_store: "browser",
  ai_tool: "ai",
  shell_history: "shell",
  env_file: "env",
};
export const KIND_LABELS: Record<Kind, string> = {
  keys: "Keys and tokens",
  cloud: "Cloud",
  wallets: "Wallets",
  browser: "Browser",
  ai: "AI tools",
  shell: "Shell history",
  env: ".env",
};

export const scan = scanDemo as {
  tool_version: string;
  mode: string;
  duration_ms: number;
  locations_checked: number;
  findings: Finding[];
};
type Result = { visible: string[]; blocked: string[]; ran_at: string };
export const twin = twinRun as {
  normal: Result;
  interview: Result;
  matrix: {
    secrets: { category: string; path: string }[];
    columns: { trap_id: string; account_label: string; ran_at: string; cells: string[] }[];
  };
};
export const acct = account as {
  setup_wall_s: number;
  setup_elevated_ms: number;
  is_admin: boolean;
  verify: {
    duration_ms: number;
    locations_checked: number;
    normal_profile_secret_locations: number;
    normal_profile_readable: number;
    readable_env_outside_profiles: string[];
    hardening_missing: string[];
  };
};
export const cov = coverage as {
  attacker_source: { name: string; url: string };
  target: string;
  check_id: string | null;
  note: string;
}[];
export const recorded = meta as { tool_version: string; recorded_on: string; machine: string; sha256?: string };
export const setupLines = setupTranscript.lines as string[];

/** Plain names for the two recorded accounts. */
export const ACCOUNT_NAMES: Record<string, string> = { normal: "Your account", interview: "The spare room" };

/** Cells of one account's column in the recorded matrix. */
export function cellsFor(label: string): string[] {
  return twin.matrix.columns.find((c) => c.account_label === label)?.cells ?? [];
}

/** The tool's own words, swapped for the site's plain ones. Numbers are never touched. */
export function plain(text: string): string {
  return text
    .replace(/the interview account's/g, "the spare room's")
    .replace(/the interview account/g, "the spare room")
    .replace(/interview account/g, "spare room")
    .replace(/finish-setup/g, "the spare room's first-time setup");
}

/** ".ssh/id_rsa" -> ".ssh\id_rsa", as Windows prints it. */
export function winPath(p: string): string {
  return p.replace(/\//g, "\\");
}

export function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, it) => {
    const k = key(it);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}
