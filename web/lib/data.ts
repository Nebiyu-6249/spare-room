// Recorded output from the real tool, exported by packaging/export_recorded.py.
// Paths are redacted there; nothing here is generated in the browser.
import scanDemo from "@/data/scan_demo.json";
import trapVscode from "@/data/trap_vscode_demo.json";
import twinRun from "@/data/twin_run.json";
import account from "@/data/account.json";
import coverage from "@/data/coverage.json";
import meta from "@/data/meta.json";

export const APP_NAME = "Spare Room";
export const REPO_URL = "https://github.com/Nebiyu-6249/spare-room";
export const RELEASE_URL = `${REPO_URL}/releases/latest`;

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

export const scan = scanDemo as {
  tool_version: string;
  mode: string;
  duration_ms: number;
  locations_checked: number;
  findings: Finding[];
};
export const vscodeTrap = trapVscode as { visible: string[]; blocked: string[]; ran_at: string };
export const twin = twinRun as {
  normal: { visible: string[]; blocked: string[]; ran_at: string };
  interview: { visible: string[]; blocked: string[]; ran_at: string };
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

export function categoryOf(path: string, findings: Finding[] = scan.findings): string {
  return findings.find((f) => f.path === path)?.category ?? "";
}

export function countBy<T>(items: T[], key: (t: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, it) => {
    const k = key(it);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
}
