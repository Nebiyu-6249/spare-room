# Spare Room

A Windows tool for developers about to run code from a recruiter or client
(take-home tests, "fix this repo" gigs). It shows what that code could reach
on your laptop right now, creates a separate standard "interview" account in
about 30 seconds so stranger code runs away from your keys and wallets, and
proves the difference by running the same harmless probe from both accounts.
Fully offline. No AI, no telemetry, no sign-in.

- **Live demo:** DEMO_URL_PENDING (replays output recorded from the real tool on a test machine)
- **Download:** [latest release](https://github.com/Nebiyu-6249/spare-room/releases/latest) (`spareroom.exe` + `SHA256SUMS.txt`)
- **Results:** [EVALUATION.md](EVALUATION.md)

## What it does

| Command | Admin? | What happens |
|---|---|---|
| `scan [--demo] [--json PATH]` | no | Lists what code running as you could reach, by category, with paths. Never prints a secret value. |
| `report [--demo]` | no | Same scan, written to a local HTML report and opened. The report loads nothing external. |
| `setup` | yes (UAC) | Creates a standard (non-admin) local account. You type its password in a Windows PowerShell window; it never passes through the tool. |
| `finish-setup` | no | Run once inside the new account: VS Code Workspace Trust on, automatic tasks off, npm `ignore-scripts`, Claude Code hooks off. Then runs `verify`. |
| `verify [--only-profile NAME]` | no | Run inside the new account: lists anything still reachable from there, such as a `.env` every user can read. |
| `remove-account` | yes (UAC) | Removes the account only if Spare Room created it, never an administrator. Explains how to delete its folder; does not delete it. |

Categories checked: SSH keys, cloud credentials (AWS, Google Cloud, Azure),
developer tokens (npm, GitHub CLI, git config), `.env` files on every fixed
drive, crypto wallet browser extensions and desktop wallets, browser password
stores, AI tool sign-ins, PowerShell history, and editor settings. Every
location cites the public report or official doc it comes from; see
[spareroom/locations.py](spareroom/locations.py) and the coverage table in
[EVALUATION.md](EVALUATION.md).

## Recorded results (Windows 11 Home, 2026-11-04)

- The same probe, against the same 13 fake secrets: **13 of 13 reachable** from
  the normal account, **0 of 13** from the interview account (all blocked).
- `setup` created the interview account in **29.6 s**.
- `verify` from the interview account: all 12 known secret locations in the
  normal account's folder were access denied. It also found one `.env` outside
  any account folder that every user could read, which is the kind of leak a
  separate account cannot fix.
- 25 of 36 targets named in public attacker reports are covered by a check.

## Try it safely

Demo mode needs no admin rights and touches only the fake laptop bundled with
the tool. Every planted value in it is fake and marked `FAKE-DEMO`.

```powershell
spareroom.exe scan --demo
spareroom.exe report --demo
```

### The exe is unsigned

Windows SmartScreen may warn about it. Check the checksum against
`SHA256SUMS.txt` in the release first:

```powershell
Get-FileHash .\spareroom.exe -Algorithm SHA256
```

If it matches and you choose to run it, pick **More info**, then **Run anyway**.

### Or run from source

Python 3.12, standard library only.

```powershell
git clone https://github.com/Nebiyu-6249/spare-room
cd spare-room
python -m spareroom scan --demo
python -m pip install pytest
python -m pytest
```

To run the account commands from source in the interview account, Python must
be installed for all users. The exe avoids that: `setup` copies it to
`C:\Program Files\Spare Room\`.

## The tricks this guards against

Each one runs code from a project without you reading it first. Spare Room does
not reproduce them; the links describe them.

- **VS Code task on folder open.** A project's `.vscode/tasks.json` can ask
  VS Code to run a command as soon as a trusted folder opens.
  [VS Code tasks docs](https://code.visualstudio.com/docs/debugtest/tasks),
  [GitLab on Contagious Interview](https://about.gitlab.com/blog/how-to-detect-and-prevent-contagious-interview-ide-attacks/).
  The repo includes a harmless fixture for this one in
  [traps/vscode_task](traps/vscode_task) that only runs the probe.
- **npm install scripts.** A package can declare a `preinstall` or
  `postinstall` script that runs during `npm install`.
  [Unit 42 on Shai-Hulud](https://unit42.paloaltonetworks.com/npm-supply-chain-attack/),
  [StepSecurity on s1ngularity](https://www.stepsecurity.io/blog/supply-chain-security-alert-popular-nx-build-system-package-compromised-with-data-stealing-malware).
- **Code hidden in an otherwise normal project, run by `npm run dev`.** The
  project looks fine at a glance, and starting it as asked runs the hidden part.
  [Unit 42 on BeaverTail in npm packages](https://unit42.paloaltonetworks.com/two-campaigns-by-north-korea-bad-actors-target-job-hunters/).
- **Python `setup.py`.** Installing a package from source runs its `setup.py`.
  [The Hacker News on fake coding tests](https://thehackernews.com/2024/09/developers-beware-lazarus-group-uses.html),
  [ESET's study of malicious PyPI packages (summary)](https://cybersecuritynews.com/116-malicious-pypi-packages/amp/).
- **Claude Code startup hook.** A project's `.claude/settings.json` can define
  hooks, such as `SessionStart`, that run commands when a session starts.
  [Claude Code hooks docs](https://code.claude.com/docs/en/hooks),
  [permissions and workspace trust](https://code.claude.com/docs/en/permissions).

## Limitations

- **A separate account is weaker than a virtual machine.** Malware running with
  administrator rights, files that every user can read, and a shared network
  or VPN can still be reached. `verify` lists the readable files it can find.
- **Settings stop code from running by itself, but only the separate account
  protects you once you run the project.** npm's own docs say that with
  `ignore-scripts` set, `npm start`, `npm stop`, `npm restart`, `npm test` and
  `npm run` still run their intended script; only pre- and post-scripts are
  skipped.
- A repo's own `.claude/settings.json` can turn Claude Code hooks back on. For
  an untrusted repo, start Claude with `--settings '{"disableAllHooks": true}'`.
- Gemini CLI settings are not changed: their docs could not be confirmed.
- The scanner never reads secret values, so it cannot tell a real key from a
  placeholder. Readability comes from Windows file permissions.
- Windows only. macOS and Linux account setup are out of scope for v1.
- 11 of 36 documented attacker targets are not covered yet (for example Firefox
  logins, Ledger and Trezor data); EVALUATION.md says why for each.
- The exe is not code-signed.

## Privacy

The scan reads only what it needs to classify a file: whether it exists, its
permissions, the first 40 bytes of an SSH key file, setting names in `.npmrc`,
and two settings in VS Code's `settings.json`. It never prints, logs, saves or
sends a secret value (tested with planted values), never uses the network
(tested), never deletes or moves your files. The browser demo has no analytics
or cookies and loads nothing from other sites.

## Repository layout

- `spareroom/` the tool (scanner, probe, report, accounts, hardening, verify, coverage, matrix)
- `tests/` pytest suite
- `demo/` the bundled fake laptop and the script that rebuilds it
- `traps/vscode_task/` harmless VS Code fixture that only runs the probe
- `packaging/` exe build and the export of recorded results for the web demo
- `web/` the browser demo (Next.js static export)
- `docs/` the manual account test checklist

## Credits

Built during SafeSpace Hacks (Oct 17 - Nov 22, 2026) by Elias Aweke, with
[Claude Code](https://claude.com/claude-code) as a coding assistant for the
tool, tests, docs and web demo.

Attacker target lists come from public research by Palo Alto Networks Unit 42,
GitGuardian, StepSecurity, Socket, Semgrep, GitLab, OpenSourceMalware and
MITRE ATT&CK. Setting names come from the official VS Code, npm, Claude Code,
AWS, Google Cloud, Azure, GitHub CLI and Microsoft PowerShell docs.
