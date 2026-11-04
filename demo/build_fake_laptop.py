"""Build the bundled fake laptop under demo/fake_laptop/.

Every planted value is obviously fake (marked FAKE-DEMO) so it cannot be a real
secret and will not trip GitHub push protection. The scanner only checks that
these paths exist (and, for a couple, that a key *name* is present); it never
reads their values. Run: python demo/build_fake_laptop.py
"""

from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "fake_laptop"
HOME = ROOT / "C" / "Users" / "testdev"

FAKE = "FAKE-DEMO"

# path (relative to HOME unless it starts with a drive marker) -> text content.
# A trailing "/" marks a directory; None content means empty dir.
FILES = {
    # ssh
    ".ssh/id_rsa": f"-----BEGIN OPENSSH PRIVATE KEY-----\n{FAKE} not a real key, placeholder only\n-----END OPENSSH PRIVATE KEY-----\n",
    ".ssh/config": "Host example\n    HostName example.com\n    User testdev\n    IdentityFile ~/.ssh/id_rsa\n",
    # cloud
    ".aws/credentials": f"[default]\naws_access_key_id = {FAKE}-key-id\naws_secret_access_key = {FAKE}-secret-placeholder\n",
    ".aws/config": "[default]\nregion = us-east-1\noutput = json\n",
    "AppData/Roaming/gcloud/application_default_credentials.json":
        f'{{"type": "authorized_user", "client_id": "{FAKE}", "refresh_token": "{FAKE}-placeholder"}}\n',
    ".azure/azureProfile.json": f'{{"subscriptions": [{{"name": "{FAKE} Subscription", "id": "{FAKE}"}}]}}\n',
    # token
    ".npmrc": f"//registry.npmjs.org/:_authToken={FAKE}-npm-token-placeholder\n",
    "AppData/Roaming/GitHub CLI/hosts.yml":
        f"github.com:\n    oauth_token: {FAKE}-gh-token-placeholder\n    user: testdev\n",
    ".gitconfig": "[user]\n    name = Test Dev\n    email = testdev@example.com\n",
    # desktop wallets
    ".config/solana/id.json": f'["{FAKE} solana keypair placeholder - not a real key"]\n',
    "AppData/Roaming/Exodus/exodus.wallet/seed.seco": f"{FAKE} exodus seed placeholder\n",
    "AppData/Roaming/Electrum/wallets/default_wallet": f"{FAKE} electrum wallet placeholder\n",
    # ai tools
    ".claude/.credentials.json": f'{{"claudeAiOauth": {{"accessToken": "{FAKE}-placeholder"}}}}\n',
    ".claude.json": f'{{"account": "{FAKE} placeholder"}}\n',
    ".claude/settings.json": '{\n    "model": "default"\n}\n',
    ".gemini/settings.json": '{\n    "theme": "Default"\n}\n',
    # shell history
    "AppData/Roaming/Microsoft/Windows/PowerShell/PSReadLine/ConsoleHost_history.txt":
        f"cd projects\nnpm install\nsetx DEMO_API_KEY {FAKE}-secret-on-command-line\ngit push\n",
    # editor setting (deliberately risky, to show a high editor_setting finding)
    "AppData/Roaming/Code/User/settings.json":
        '{\n    "security.workspace.trust.enabled": false,\n    "task.allowAutomaticTasks": "on"\n}\n',
    # browser password / autofill stores (Chrome Default)
    "AppData/Local/Google/Chrome/User Data/Local State": f"{FAKE} chrome local state placeholder\n",
    "AppData/Local/Google/Chrome/User Data/Default/Login Data": f"{FAKE} chrome login data placeholder\n",
    "AppData/Local/Google/Chrome/User Data/Default/Web Data": f"{FAKE} chrome web data placeholder\n",
    # wallet extension storage (MetaMask + Phantom, Chrome Default)
    "AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/nkbihfbeogaeaoehlefnkodbefgpgknn/000003.log":
        f"{FAKE} metamask extension storage placeholder\n",
    "AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/bfnaelmomeimhlpmgjnjophhpkkoljpa/000003.log":
        f"{FAKE} phantom extension storage placeholder\n",
    # .env files across drives (one in node_modules must be SKIPPED by the scan)
    "projects/demo-app/.env": f"API_KEY={FAKE}-env-secret\nDATABASE_URL=postgres://user:{FAKE}@localhost/db\n",
    "projects/demo-app/node_modules/leftpad/.env": f"SHOULD_NOT_BE_FOUND={FAKE}\n",
}

# Files placed on the D: drive to prove the .env hunt crosses drives.
D_FILES = {
    "D/work/client-repo/.env": f"CLIENT_TOKEN={FAKE}-env-secret\n",
}


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> None:
    if ROOT.exists():
        shutil.rmtree(ROOT)
    for rel, content in FILES.items():
        write(HOME / rel, content)
    for rel, content in D_FILES.items():
        write(ROOT / rel, content)
    print(f"Fake laptop built at {ROOT}")
    print(f"  home:   {HOME}")
    print(f"  files:  {len(FILES) + len(D_FILES)}")


if __name__ == "__main__":
    main()
