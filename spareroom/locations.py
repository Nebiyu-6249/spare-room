"""The catalog of places stranger code is known to reach on a Windows dev box.

Every entry cites a public report or official doc in ``source_ref``. Paths and
identifiers are taken from those sources, not invented. Nothing here reads a
value: the catalog only says where to look and how to recognise a hit.

Checks (dispatched in scanner.py):
  exists        - path is present and readable
  private_key   - an SSH key file; confirm by name, peek header only to label it
  npmrc_token   - an .npmrc; record only whether an auth-token key is present
  vscode_user   - VS Code user settings.json; record only whether auto-run is open
  claude_creds  - Claude Code credential/account file
  wallet_ext    - a browser "Local Extension Settings" dir holding a known wallet
  env_scan      - .env files across all drives, skipping node_modules
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

# --- Source references (public reports / official docs) ----------------------

SRC_UNIT42 = "https://unit42.paloaltonetworks.com/north-korean-threat-actors-lure-tech-job-seekers-as-fake-recruiters/"
SRC_GITGUARDIAN = "https://blog.gitguardian.com/the-nx-s1ngularity-attack-inside-the-credential-leak/"
SRC_STEPSECURITY = "https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware"
SRC_SHAIHULUD = "https://attack.mitre.org/software/S9008/"
SRC_SOCKET = "https://socket.dev/blog/lazarus-strikes-npm-again-with-a-new-wave-of-malicious-packages"
SRC_T1555_003 = "https://attack.mitre.org/techniques/T1555/003/"
SRC_T1552_003 = "https://attack.mitre.org/techniques/T1552/003/"
SRC_VSCODE_TASKS = "https://code.visualstudio.com/docs/debugtest/tasks"
SRC_VSCODE_TRUST = "https://code.visualstudio.com/docs/editing/workspaces/workspace-trust"
SRC_GH = "https://cli.github.com/manual/gh_help_environment"
SRC_GCP = "https://cloud.google.com/docs/authentication/application-default-credentials"
SRC_AZURE = "https://learn.microsoft.com/en-us/cli/azure/azure-cli-configuration"
SRC_AWS = "https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html"
SRC_CLAUDE = "https://code.claude.com/docs/en/settings"


# --- Known wallet browser-extension IDs -------------------------------------
# Verbatim from Unit 42's BeaverTail Qt-variant table (12 of the 13 it names
# rendered as text; the original JS-variant table adds Ronin). IDs are exact.
WALLET_EXTENSIONS = {
    "nkbihfbeogaeaoehlefnkodbefgpgknn": "MetaMask",
    "ejbalbakoplchlghecdalmeeeajnimhm": "MetaMask (Edge)",
    "fhbohimaelbohpjbbldcngcnapndodjp": "BNB Chain Wallet (Binance)",
    "hnfanknocfeofbddgcijnmhnfnkdnaad": "Coinbase Wallet",
    "ibnejdfjmmkpcnlpebklmnkoeoihofec": "TronLink",
    "bfnaelmomeimhlpmgjnjophhpkkoljpa": "Phantom",
    "aeachknmefphepccionboohckonoeemg": "Coin98",
    "hifafgmccdpekplomjjkcfgodnhcellj": "Crypto.com Wallet",
    "jblndlipeogpafnldhgmapagcccfchpi": "Kaikas",
    "acmacodkjbdgmoleebolmdjonilkdbch": "Rabby",
    "dlcobpjiigpikoobohmabehhmhfoodbb": "Argent X",
    "aholpfdialjgjfhomihkjbmgjidlcdno": "Exodus Web3",
    "fnjhmkhhmkbjkkabndcnnogagogbneec": "Ronin",
}

# Chromium-family browsers and their User Data folder, relative to the home dir.
# Used for both wallet-extension storage and saved-password stores.
BROWSER_USER_DATA = (
    ("Chrome", ("AppData", "Local", "Google", "Chrome", "User Data")),
    ("Edge", ("AppData", "Local", "Microsoft", "Edge", "User Data")),
    ("Brave", ("AppData", "Local", "BraveSoftware", "Brave-Browser", "User Data")),
)

# Browser profile directories to look inside (first few; real scan can add more).
BROWSER_PROFILES = ("Default", "Profile 1", "Profile 2")

# .env hunt, matching InvisibleFerret's ssh_env behaviour.
ENV_FILENAMES = (".env", ".env.local", ".env.development", ".env.production")
# node_modules is skipped to match InvisibleFerret; the rest are large system
# trees with no project .env files, pruned to keep a full-drive scan under a minute.
ENV_SKIP_DIRS = {
    "node_modules", ".git", "AppData", "Windows", "WinSxS", "$Recycle.Bin",
    "Program Files", "Program Files (x86)", "ProgramData", "System Volume Information",
    ".cache", "venv", ".venv", "__pycache__",
}
ENV_MAX_DEPTH = 8  # keep the walk bounded so a scan stays under a minute


@dataclass(frozen=True)
class LocationSpec:
    id: str
    category: str
    check: str
    rel: Optional[Tuple[str, ...]]  # path parts under home; None for drive scans
    kind: str
    severity: str
    reason: str
    fix: str
    source_ref: str


# --- Home-relative specs -----------------------------------------------------
SPECS = [
    # ssh
    LocationSpec(
        "ssh-id-rsa", "ssh", "private_key", (".ssh", "id_rsa"), "SSH private key",
        "high",
        "An SSH private key signs into servers and Git hosts as you. The s1ngularity payload grabbed id_rsa directly.",
        "Move this key to the interview account's reach only, or use a hardware/agent-backed key. Passphrase-protect it.",
        SRC_GITGUARDIAN,
    ),
    LocationSpec(
        "ssh-id-ed25519", "ssh", "private_key", (".ssh", "id_ed25519"), "SSH private key",
        "high",
        "An SSH private key signs into servers and Git hosts as you.",
        "Keep it out of the account where you run untrusted code; passphrase-protect it.",
        SRC_GITGUARDIAN,
    ),
    LocationSpec(
        "ssh-config", "ssh", "exists", (".ssh", "config"), "SSH config",
        "info",
        "Your SSH config lists the hosts and key files you connect to, a map for an attacker.",
        "No action needed, but note it reveals your other keys and hosts.",
        SRC_GITGUARDIAN,
    ),
    # cloud
    LocationSpec(
        "aws-credentials", "cloud", "exists", (".aws", "credentials"), "AWS credentials",
        "high",
        "This file holds long-lived AWS access keys. Shai-Hulud read ~/.aws/credentials to pivot into cloud accounts.",
        "Prefer short-lived SSO sessions; keep this file out of the interview account.",
        SRC_SHAIHULUD,
    ),
    LocationSpec(
        "aws-config", "cloud", "exists", (".aws", "config"), "AWS config",
        "medium",
        "The AWS config names your profiles, regions and SSO start URLs.",
        "Lower risk than credentials, but still account structure an attacker can use.",
        SRC_AWS,
    ),
    LocationSpec(
        "gcloud-adc", "cloud", "exists",
        ("AppData", "Roaming", "gcloud", "application_default_credentials.json"),
        "GCP application-default credentials", "high",
        "This JSON is a usable Google Cloud credential. Shai-Hulud collected application_default_credentials.json.",
        "Run 'gcloud auth application-default revoke' when not in use; keep it out of the interview account.",
        SRC_SHAIHULUD,
    ),
    LocationSpec(
        "azure-profile", "cloud", "exists",
        (".azure", "azureProfile.json"), "Azure CLI profile", "medium",
        "The Azure CLI stores your subscriptions and signed-in identity here; its token cache sits beside it.",
        "Sign out of unused subscriptions; keep the .azure folder out of the interview account.",
        SRC_SHAIHULUD,
    ),
    # token
    LocationSpec(
        "npmrc", "token", "npmrc_token", (".npmrc",), "npm auth token",
        "high",
        "A registry auth token in .npmrc lets code publish packages as you. Shai-Hulud and s1ngularity both read ~/.npmrc.",
        "Use a short-lived or granular token; set ignore-scripts; keep .npmrc out of the interview account.",
        SRC_SHAIHULUD,
    ),
    LocationSpec(
        "gh-hosts", "token", "exists",
        ("AppData", "Roaming", "GitHub CLI", "hosts.yml"), "GitHub CLI token", "high",
        "The GitHub CLI stores your OAuth token in hosts.yml, full access to your repos.",
        "Keep the GitHub CLI signed in only in the interview account, or use a fine-grained token there.",
        SRC_GH,
    ),
    LocationSpec(
        "gitconfig", "token", "exists", (".gitconfig",), "Git config",
        "medium",
        "Your .gitconfig can embed credential-helper tokens or URLs with secrets. s1ngularity collected .gitconfig.",
        "Check for inline tokens; prefer an OS credential manager.",
        SRC_GITGUARDIAN,
    ),
    # desktop_wallet
    LocationSpec(
        "solana-id", "desktop_wallet", "exists",
        (".config", "solana", "id.json"), "Solana keypair", "high",
        "id.json is an unencrypted Solana private key. Lazarus npm packages extracted ~/.config/solana/id.json.",
        "Do not keep funded keypairs on a dev box; move this out of the interview account.",
        SRC_SOCKET,
    ),
    LocationSpec(
        "exodus-wallet", "desktop_wallet", "exists",
        ("AppData", "Roaming", "Exodus", "exodus.wallet"), "Exodus wallet data", "high",
        "Exodus stores its wallet here; the same campaigns target exodus.wallet.",
        "Keep crypto wallets off the machine where you run stranger code.",
        SRC_STEPSECURITY,
    ),
    LocationSpec(
        "electrum-wallets", "desktop_wallet", "exists",
        ("AppData", "Roaming", "Electrum", "wallets"), "Electrum wallet folder", "medium",
        "Electrum keeps wallet files here; s1ngularity's wallet hunt listed Electrum.",
        "Encrypt wallets and keep them off this machine.",
        SRC_STEPSECURITY,
    ),
    # ai_tool
    LocationSpec(
        "claude-creds", "ai_tool", "claude_creds", (".claude",), "Claude Code credentials",
        "high",
        "s1ngularity enumerated AI CLI config and tokens (Claude, Gemini, Q). A stored session token here acts as you.",
        "Sign the AI CLIs in inside the interview account instead; turn off startup hooks there.",
        SRC_GITGUARDIAN,
    ),
    LocationSpec(
        "gemini-settings", "ai_tool", "exists",
        (".gemini", "settings.json"), "Gemini CLI settings", "medium",
        "s1ngularity targeted the Gemini CLI's config alongside Claude and Q.",
        "Keep the Gemini CLI signed in only in the interview account.",
        SRC_GITGUARDIAN,
    ),
    # shell_history
    LocationSpec(
        "ps-history", "shell_history", "exists",
        ("AppData", "Roaming", "Microsoft", "Windows", "PowerShell", "PSReadLine", "ConsoleHost_history.txt"),
        "PowerShell history", "medium",
        "PSReadLine saves every command across sessions. Secrets typed on a command line linger here (MITRE T1552.003).",
        "Clear it, and avoid passing secrets as command-line arguments.",
        SRC_T1552_003,
    ),
    # editor_setting
    LocationSpec(
        "vscode-user-settings", "editor_setting", "vscode_user",
        ("AppData", "Roaming", "Code", "User", "settings.json"), "VS Code user settings",
        "info",
        "A malicious .vscode/tasks.json runs on folder-open if automatic tasks are allowed and the folder is trusted.",
        "Keep Workspace Trust on and task.allowAutomaticTasks off; finish-setup does this for the interview account.",
        SRC_VSCODE_TASKS,
    ),
]
