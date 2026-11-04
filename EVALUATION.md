# Evaluation

Status: outline. The coverage table is generated from `spareroom/coverage.py`.
The trap matrix and setup times are filled in from the test VM.

## 1. Trap-by-secret matrix (both accounts)

The probe was run once from each account against the same copy of the bundled
fake laptop, placed inside the normal account's profile. Nothing was written to
real credential locations. Success criterion 4: the normal account reaches every
fake secret, and the interview account reaches none of them. Generated from the
recorded results with `python -m spareroom.matrix`.

<!-- matrix:start -->
Pending: the interview account's run.
<!-- matrix:end -->

## 2. Coverage against public attacker target lists

Regenerate with `python -m spareroom.coverage --update EVALUATION.md`.

<!-- coverage:start -->
25 of 36 documented targets are covered by a check.

| Source | Target | Check |
|---|---|---|
| [Unit 42: Contagious Interview (BeaverTail/InvisibleFerret), 2024](https://unit42.paloaltonetworks.com/north-korean-threat-actors-lure-tech-job-seekers-as-fake-recruiters/) | Wallet browser extensions by ID (MetaMask, Phantom, Coinbase Wallet and others; 12 of the 13 IDs the report names were readable in its text) | `wallet_extension` (browser wallet extension storage (Chrome, Edge, Brave)) |
| [Unit 42: Contagious Interview (BeaverTail/InvisibleFerret), 2024](https://unit42.paloaltonetworks.com/north-korean-threat-actors-lure-tech-job-seekers-as-fake-recruiters/) | .env files on all drives, skipping node_modules | `env_scan` (.env files on all fixed drives, skipping node_modules) |
| [Unit 42: Contagious Interview (BeaverTail/InvisibleFerret), 2023](https://unit42.paloaltonetworks.com/two-campaigns-by-north-korea-bad-actors-target-job-hunters/) | Solana keypair ~/.config/solana/id.json | `solana-id` |
| [Unit 42: Contagious Interview (BeaverTail/InvisibleFerret), 2023](https://unit42.paloaltonetworks.com/two-campaigns-by-north-korea-bad-actors-target-job-hunters/) | Saved browser logins | `browser_store` (browser Login Data, Web Data, Local State (Chrome, Edge, Brave)) |
| [Unit 42: Contagious Interview (BeaverTail/InvisibleFerret), 2023](https://unit42.paloaltonetworks.com/two-campaigns-by-north-korea-bad-actors-target-job-hunters/) | AnyDesk configuration | Not covered: Remote-access setup, not a stored secret. |
| [Unit 42: Contagious Interview (BeaverTail/InvisibleFerret), 2023](https://unit42.paloaltonetworks.com/two-campaigns-by-north-korea-bad-actors-target-job-hunters/) | Keystrokes and clipboard | Not covered: Captured live, not a file the scanner can find. |
| [GitGuardian: Nx s1ngularity](https://blog.gitguardian.com/the-nx-s1ngularity-attack-inside-the-credential-leak/) | Claude CLI config and tokens | `claude-creds` |
| [GitGuardian: Nx s1ngularity](https://blog.gitguardian.com/the-nx-s1ngularity-attack-inside-the-credential-leak/) | Gemini CLI config and tokens | `gemini-settings` |
| [GitGuardian: Nx s1ngularity](https://blog.gitguardian.com/the-nx-s1ngularity-attack-inside-the-credential-leak/) | Amazon Q CLI config and tokens | Not covered: Its config location is not yet confirmed in docs. |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | npm tokens in ~/.npmrc | `npmrc` |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | SSH private keys (id_rsa) | `ssh-id-rsa` |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | .env files | `env_scan` (.env files on all fixed drives, skipping node_modules) |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | .gitconfig | `gitconfig` |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | GitHub token from gh auth token | `gh-hosts` |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | Exodus wallet | `exodus-wallet` |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | Electrum wallets | `electrum-wallets` |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | MetaMask and Phantom | `wallet_extension` (browser wallet extension storage (Chrome, Edge, Brave)) |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | Ledger and Trezor data | Not covered: No confirmed Windows path yet. |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | Solflare wallet | Not covered: No confirmed Windows path yet. |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | Generic keystore files (UTC--*, keystore.json) | Not covered: Needs a name search across folders; not built. |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | Environment variables | Not covered: Live process state, not a file. |
| [StepSecurity: Nx s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware) | Shell startup files (.bashrc, .zshrc) | Not covered: The payload skipped Windows; these are Unix files. |
| [MITRE ATT&CK S9008: Shai-Hulud](https://attack.mitre.org/software/S9008/) | ~/.aws/credentials | `aws-credentials` |
| [MITRE ATT&CK S9008: Shai-Hulud](https://attack.mitre.org/software/S9008/) | application_default_credentials.json (Google Cloud) | `gcloud-adc` |
| [MITRE ATT&CK S9008: Shai-Hulud](https://attack.mitre.org/software/S9008/) | azureProfile.json (Azure CLI) | `azure-profile` |
| [MITRE ATT&CK S9008: Shai-Hulud](https://attack.mitre.org/software/S9008/) | .npmrc | `npmrc` |
| [MITRE ATT&CK S9008: Shai-Hulud](https://attack.mitre.org/software/S9008/) | GitHub config files | `gh-hosts` |
| [MITRE ATT&CK S9008: Shai-Hulud](https://attack.mitre.org/software/S9008/) | Cloud metadata endpoints and secret managers | Not covered: Reached over the network; out of scope for an offline scan. |
| [Socket: Lazarus npm packages](https://socket.dev/blog/lazarus-strikes-npm-again-with-a-new-wave-of-malicious-packages) | Chrome and Brave Login Data | `browser_store` (browser Login Data, Web Data, Local State (Chrome, Edge, Brave)) |
| [Socket: Lazarus npm packages](https://socket.dev/blog/lazarus-strikes-npm-again-with-a-new-wave-of-malicious-packages) | Firefox logins | Not covered: Firefox is not checked yet. |
| [Socket: Lazarus npm packages](https://socket.dev/blog/lazarus-strikes-npm-again-with-a-new-wave-of-malicious-packages) | Browser Local Extension Settings (wallets) | `wallet_extension` (browser wallet extension storage (Chrome, Edge, Brave)) |
| [Socket: Lazarus npm packages](https://socket.dev/blog/lazarus-strikes-npm-again-with-a-new-wave-of-malicious-packages) | Solana id.json | `solana-id` |
| [Socket: Lazarus npm packages](https://socket.dev/blog/lazarus-strikes-npm-again-with-a-new-wave-of-malicious-packages) | Exodus exodus.wallet | `exodus-wallet` |
| [Socket: Lazarus npm packages](https://socket.dev/blog/lazarus-strikes-npm-again-with-a-new-wave-of-malicious-packages) | macOS keychain | Not covered: macOS is out of scope for v1. |
| [MITRE ATT&CK T1552.003: Shell History](https://attack.mitre.org/techniques/T1552/003/) | PowerShell persistent history (ConsoleHost_history.txt) | `ps-history` |
| [MITRE ATT&CK T1555.003: Credentials from Web Browsers](https://attack.mitre.org/techniques/T1555/003/) | Chrome Login Data | `browser_store` (browser Login Data, Web Data, Local State (Chrome, Edge, Brave)) |
<!-- coverage:end -->

## 3. Measured setup times (Windows 11 Home)

Target (criterion 3): under 5 minutes in total.

| Step | Time | Notes |
|---|---|---|
| `setup` (from start to "Created") | _pending VM run_ | includes the UAC prompt and typing the password twice |
| First sign-in to the interview account | _pending VM run_ | Windows builds the profile |
| `finish-setup` (settings and verify) | _pending VM run_ | |
| **Total** | _pending_ | |

## 4. Scan timing

| Run | Time | Locations checked | Notes |
|---|---|---|---|
| `scan --demo` (bundled fake laptop) | ~0.1 s | 165 | dev machine |
| `scan` (real, dev machine, one drive) | 8.4 s | 158 | full C: walk for `.env` finished inside the 50 s budget |
| `verify` (real, dev machine, not elevated) | 4.1 s | 896 | includes other profiles under C:\Users |

## 5. Limits

- A separate standard account is weaker than a virtual machine. Malware running
  with administrator rights, files every user can read, and a shared network
  or VPN can still be reached.
- A repo's own `.claude/settings.json` can turn Claude Code hooks back on.
- npm `ignore-scripts` does not stop scripts started by name (`npm start`,
  `npm run dev`).
- Readability is decided from Windows permissions (AccessCheck). Contents are
  never read, so the scanner cannot tell a real key from a placeholder.
