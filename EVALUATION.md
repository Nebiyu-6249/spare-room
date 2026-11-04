# Evaluation

Recorded on 2026-11-04 on a Windows 11 Home laptop (the developer's own
machine, used in place of a VM with the developer's agreement). The interview
account was a fresh standard account created by `spareroom setup`. Every
number below comes from the tool's own recorded output. Paths under other
people's profiles are left out on purpose.

## 1. Trap-by-secret matrix (both accounts)

The probe was run once from each account against the same copy of the bundled
fake laptop, placed inside the normal account's profile. Nothing was written to
real credential locations. Success criterion 4: the normal account reaches every
fake secret, and the interview account reaches none of them. Generated from the
recorded results with `python -m spareroom.matrix`.

<!-- matrix:start -->
- **normal** (2026-11-04T18:55:28+04:00): 13 of 13 visible, 0 blocked, 0 absent.
- **interview** (2026-11-04T18:58:26+04:00): 0 of 13 visible, 13 blocked, 0 absent.

| Category | Fake secret (relative to the fake home) | twin_probe as normal | twin_probe as interview |
|---|---|---|---|
| ssh | `.ssh/id_rsa` | visible | blocked |
| cloud | `.aws/credentials` | visible | blocked |
| cloud | `AppData/Roaming/gcloud/application_default_credentials.json` | visible | blocked |
| cloud | `.azure/azureProfile.json` | visible | blocked |
| token | `.npmrc` | visible | blocked |
| token | `AppData/Roaming/GitHub CLI/hosts.yml` | visible | blocked |
| desktop_wallet | `.config/solana/id.json` | visible | blocked |
| desktop_wallet | `AppData/Roaming/Exodus/exodus.wallet/seed.seco` | visible | blocked |
| ai_tool | `.claude/.credentials.json` | visible | blocked |
| shell_history | `AppData/Roaming/Microsoft/Windows/PowerShell/PSReadLine/ConsoleHost_history.txt` | visible | blocked |
| browser_store | `AppData/Local/Google/Chrome/User Data/Default/Login Data` | visible | blocked |
| wallet_extension | `AppData/Local/Google/Chrome/User Data/Default/Local Extension Settings/nkbihfbeogaeaoehlefnkodbefgpgknn/000003.log` | visible | blocked |
| env_file | `projects/demo-app/.env` | visible | blocked |
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
| `setup` (from start to "Created") | **29.6 s** | 25.7 s of it in the elevated window, including the UAC prompt and typing the password twice |
| First sign-in to the interview account | not measured | Windows builds the profile here; it was not timed |
| `finish-setup` (settings only) | under 1 s | the settings step; verify ran separately (below) |
| **Total of the timed steps** | **about 30 s** | plus the first sign-in, which was not timed |

The timed steps are far inside the 5-minute target. Criterion 3 is met only
if the first sign-in takes less than about 4.5 minutes; it is usually one to
two minutes, but this run did not time it.

Run notes, for honesty:
- The first `setup` run created the account and then crashed reading its own
  result file (an owner-only temp folder; fixed in `cb10cbe`). That account
  was removed with `remove-account`, and the timed run above used the fixed exe.
- `Start-Process -Credential` from the normal session was refused by Windows
  ("Access is denied") for an account that had never signed in. So the
  interview-account commands were run after one normal sign-in.
- The first interview-account probe crashed on the denied fake-laptop folder
  (fixed in `e173ac7`). The recorded run used `probe --targets` with the same
  13 paths that the normal account's run used.

## 4. verify from the interview account (criterion 5)

`verify --only-profile <normal account>` checks only the normal account's
profile, so nobody else's is examined.

| Result | Value |
|---|---|
| Known secret locations present in the normal account's profile | 12 |
| Of those, readable from the interview account | **0** (all 12: access denied) |
| `.env` files readable from the interview account outside any profile | 1, at `C:\dev\<project>\.env` (readable by every user; reported, not changed) |
| Hardening missing in the interview account | none |
| Run time / locations checked | 0.17 s / 308 |

The `.env` finding is criterion 5 working as intended: a separate account does
not protect files that every user can read.

## 5. Scan timing

| Run | Time | Locations checked | Notes |
|---|---|---|---|
| `scan --demo` (bundled fake laptop) | ~0.05 s | 159 | same result from the packaged exe |
| `scan` (real, one drive) | 8.4 s | 158 | full C: walk for `.env` finished inside the 50 s budget |
| `verify` (real, interview account) | 0.17 s | 308 | see section 4 |

## 6. Limits

- A separate standard account is weaker than a virtual machine. Malware running
  with administrator rights, files every user can read, and a shared network
  or VPN can still be reached.
- A repo's own `.claude/settings.json` can turn Claude Code hooks back on.
- npm `ignore-scripts`: per npm's own docs, `npm start`, `npm stop`,
  `npm restart`, `npm test` and `npm run` still run their intended script; only
  pre- and post-scripts are skipped. The settings stop code from running by
  itself, but only the separate account protects you once you run the project.
- The VS Code automatic-task setting was applied and checked by `verify`. A
  hands-on check (open the trap folder in VS Code in the interview account)
  was not done.
- Readability is decided from Windows permissions (AccessCheck). Contents are
  never read, so the scanner cannot tell a real key from a placeholder.
