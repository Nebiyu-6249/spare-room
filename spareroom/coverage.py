"""Coverage of public attacker target lists by the scanner's checks.

Each row is a target a public report says the malware went after, and the
check that covers it (a spec id from locations.SPECS, or one of the scanner's
group checks), or None with the reason it is not covered. Targets are worded
from the reports; nothing is added from memory.

  python -m spareroom.coverage              print the markdown table
  python -m spareroom.coverage --update F   rewrite the table inside F
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List

from . import locations as L
from .models import CoverageItem

# Checks that are not a single spec but a scanner pass.
GROUP_CHECKS = {
    "wallet_extension": "browser wallet extension storage (Chrome, Edge, Brave)",
    "browser_store": "browser Login Data, Web Data, Local State (Chrome, Edge, Brave)",
    "env_scan": ".env files on all fixed drives, skipping node_modules",
}

_U42_24 = ("Unit 42: Contagious Interview (BeaverTail/InvisibleFerret), 2024", L.SRC_UNIT42)
_U42_23 = ("Unit 42: Contagious Interview (BeaverTail/InvisibleFerret), 2023", L.SRC_UNIT42_2023)
_GG = ("GitGuardian: Nx s1ngularity", L.SRC_GITGUARDIAN)
_SS = ("StepSecurity: Nx s1ngularity", L.SRC_STEPSECURITY)
_SH = ("MITRE ATT&CK S9008: Shai-Hulud", L.SRC_SHAIHULUD)
_SO = ("Socket: Lazarus npm packages", L.SRC_SOCKET)
_T3 = ("MITRE ATT&CK T1552.003: Shell History", L.SRC_T1552_003)
_T5 = ("MITRE ATT&CK T1555.003: Credentials from Web Browsers", L.SRC_T1555_003)

# (source, target, check_id or None, note shown when not covered)
ROWS = [
    (_U42_24, "Wallet browser extensions by ID (MetaMask, Phantom, Coinbase Wallet and others; "
              "12 of the 13 IDs the report names were readable in its text)",
     "wallet_extension", ""),
    (_U42_24, ".env files on all drives, skipping node_modules", "env_scan", ""),
    (_U42_23, "Solana keypair ~/.config/solana/id.json", "solana-id", ""),
    (_U42_23, "Saved browser logins", "browser_store", ""),
    (_U42_23, "AnyDesk configuration", None, "Remote-access setup, not a stored secret."),
    (_U42_23, "Keystrokes and clipboard", None, "Captured live, not a file the scanner can find."),
    (_GG, "Claude CLI config and tokens", "claude-creds", ""),
    (_GG, "Gemini CLI config and tokens", "gemini-settings", ""),
    (_GG, "Amazon Q CLI config and tokens", None, "Its config location is not yet confirmed in docs."),
    (_SS, "npm tokens in ~/.npmrc", "npmrc", ""),
    (_SS, "SSH private keys (id_rsa)", "ssh-id-rsa", ""),
    (_SS, ".env files", "env_scan", ""),
    (_SS, ".gitconfig", "gitconfig", ""),
    (_SS, "GitHub token from gh auth token", "gh-hosts",
     ""),
    (_SS, "Exodus wallet", "exodus-wallet", ""),
    (_SS, "Electrum wallets", "electrum-wallets", ""),
    (_SS, "MetaMask and Phantom", "wallet_extension", ""),
    (_SS, "Ledger and Trezor data", None, "No confirmed Windows path yet."),
    (_SS, "Solflare wallet", None, "No confirmed Windows path yet."),
    (_SS, "Generic keystore files (UTC--*, keystore.json)", None, "Needs a name search across folders; not built."),
    (_SS, "Environment variables", None, "Live process state, not a file."),
    (_SS, "Shell startup files (.bashrc, .zshrc)", None, "The payload skipped Windows; these are Unix files."),
    (_SH, "~/.aws/credentials", "aws-credentials", ""),
    (_SH, "application_default_credentials.json (Google Cloud)", "gcloud-adc", ""),
    (_SH, "azureProfile.json (Azure CLI)", "azure-profile", ""),
    (_SH, ".npmrc", "npmrc", ""),
    (_SH, "GitHub config files", "gh-hosts", ""),
    (_SH, "Cloud metadata endpoints and secret managers", None, "Reached over the network; out of scope for an offline scan."),
    (_SO, "Chrome and Brave Login Data", "browser_store", ""),
    (_SO, "Firefox logins", None, "Firefox is not checked yet."),
    (_SO, "Browser Local Extension Settings (wallets)", "wallet_extension", ""),
    (_SO, "Solana id.json", "solana-id", ""),
    (_SO, "Exodus exodus.wallet", "exodus-wallet", ""),
    (_SO, "macOS keychain", None, "macOS is out of scope for v1."),
    (_T3, "PowerShell persistent history (ConsoleHost_history.txt)", "ps-history", ""),
    (_T5, "Chrome Login Data", "browser_store", ""),
]


def valid_check_ids() -> set:
    return {s.id for s in L.SPECS} | set(GROUP_CHECKS)


def items() -> List[CoverageItem]:
    return [CoverageItem({"name": src[0], "url": src[1]}, target, check)
            for src, target, check, _ in ROWS]


def _check_label(check_id: str) -> str:
    if check_id in GROUP_CHECKS:
        return f"`{check_id}` ({GROUP_CHECKS[check_id]})"
    return f"`{check_id}`"


def render_markdown() -> str:
    covered = sum(1 for r in ROWS if r[2])
    out = [f"{covered} of {len(ROWS)} documented targets are covered by a check.", "",
           "| Source | Target | Check |", "|---|---|---|"]
    for (name, url), target, check, note in ROWS:
        cell = _check_label(check) if check else f"Not covered: {note}"
        out.append(f"| [{name}]({url}) | {target} | {cell} |")
    return "\n".join(out) + "\n"


START, END = "<!-- coverage:start -->", "<!-- coverage:end -->"


def update_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    a, b = text.index(START) + len(START), text.index(END)
    path.write_text(text[:a] + "\n" + render_markdown() + text[b:], encoding="utf-8")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="spareroom-coverage")
    ap.add_argument("--update", metavar="FILE", help="rewrite the table between the coverage markers in FILE")
    args = ap.parse_args(argv)
    if args.update:
        update_file(Path(args.update))
        print(f"Updated {args.update}")
    else:
        print(render_markdown())
    return 0


if __name__ == "__main__":
    sys.exit(main())
