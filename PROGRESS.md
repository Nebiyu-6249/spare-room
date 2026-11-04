# Progress

## Phase 1 - demo scan, JSON, HTML report, VS Code trap, no-network test (DONE)

End to end on the bundled fake laptop.

### What works
- `spareroom scan --demo` and `spareroom scan --demo --json PATH`: scans the
  bundled fake laptop, prints a per-category summary, optionally writes JSON.
- `spareroom report --demo`: scans, writes a local HTML report and opens it.
- `spareroom.probe --demo`: the single probe; checks path reachability only
  (os.access, never reads contents), writes a TrapResult JSON.
- VS Code folder-open trap fixture in `traps/vscode_task/` with a real
  `runOn: folderOpen` task that calls the probe against the demo folder.
- All 10 finding categories are exercised by the fixture.

### Tests (pytest) - 14 passing
- `test_scan_demo.py`: under 60 s, every category present, `.env` hunt crosses
  the C and D drives and skips `node_modules`, JSON round-trips, report renders
  and references nothing external.
- `test_no_network.py`: static (no networking modules imported by scanner,
  probe, report, locations, traps, models) + runtime (scan, probe and report all
  work with `socket` disabled).
- `test_no_secret_values.py`: planted sentinel values never appear in the JSON,
  the printed summary, the probe result or the HTML; `.npmrc` token is detected
  by key name without the value leaking.

### Layout
- `spareroom/` - package: `locations.py` (cited catalog + wallet extension IDs),
  `scanner.py`, `classify`-in-scanner, `probe.py`, `traps.py`, `report.py`,
  `cli.py`, `models.py`.
- `demo/build_fake_laptop.py` - regenerates `demo/fake_laptop/` (all planted
  values marked FAKE-DEMO; the scanner never reads them).
- `traps/vscode_task/` - the folder-open trap and its README (first line states
  it is harmless: reachability only, no contents, no network).

### Notes / decisions
- Standard library only for the tool; pytest for tests (`pip install pytest`).
- Run tests: `python -m pytest`. Rebuild fixture: `python demo/build_fake_laptop.py`.
- Every location in `locations.py` cites a public report or official doc in
  `source_ref` (Unit 42, GitGuardian s1ngularity, StepSecurity, Shai-Hulud via
  MITRE, Socket, MITRE ATT&CK, VS Code / AWS / GCP / Azure / gh / npm docs).
- The 13th BeaverTail wallet extension ID from Unit 42's Qt table did not render
  as text; 12 are listed plus Ronin from the earlier JS table. Flag to confirm
  the missing ID against the live page before the final coverage table (phase 4).

## Phase 2 - real scan on Windows for every category (DONE)

`spareroom scan` (real mode) runs on the live machine, read-only, no admin.

### What works
- `real_roots()` resolves the real home (`%USERPROFILE%`) and every fixed-drive
  letter root.
- All ten categories are checked against real locations; measured on the dev box
  at 8.4 s / 158 locations (ssh, cloud, wallet_extension, desktop_wallet came
  back empty here, which is a real result, not a gap).
- The `.env` hunt now has a wall-clock budget (`budget_seconds`, default 50) and
  prunes large system trees (Windows, Program Files, ProgramData, WinSxS, ...)
  on top of node_modules. If a drive runs out of time it is reported as an
  `env_file` info finding ("env scan time-limited"), so the scan never silently
  under-reports and never runs away past 60 s.

### Tests (now 18 passing)
- `test_real_mode.py`: real_roots shape; live scan is bounded (<60 s) and every
  finding is well-formed; the env walk stops at a past deadline and records it;
  the env walk finds a project `.env` and skips `node_modules` - both
  deterministic on temp trees.

## Phase 3 - setup, finish-setup, verify, remove-account (BUILT; VM test pending)

Code and automated tests are done. The real account flow has **not** been run:
it creates a Windows account, so it waits for a VM or spare machine
(checklist: `docs/VM_TEST_PHASE3.md`).

### What works
- `setup`: explains what will happen and the limits, asks for a name (default
  `interview`), checks it, confirms, then runs one Windows PowerShell 5.1
  script through UAC (ShellExecuteEx "runas"). That window asks for the
  password twice (Read-Host -AsSecureString), so it never passes through
  Python. The script runs New-LocalUser and adds the account to Users by SID
  S-1-5-32-545, confirms it is not in Administrators (S-1-5-32-544) and writes a
  result JSON with no secrets. When running as the packaged .exe it also copies
  the exe to `C:\Program Files\Spare Room\`, where the new account can run it
  but not change it. Then it prints next steps, including that Windows builds
  the profile at first sign-in.
- `finish-setup` (inside the new account; refuses to run in an admin account
  unless --force):
  VS Code `security.workspace.trust.enabled: true`,
  `task.allowAutomaticTasks: "off"`; npm `ignore-scripts=true`; Claude Code
  `disableAllHooks: true`, `permissions.disableBypassPermissionsMode: "disable"`.
  Keeps other settings and backs up each changed file. Reads VS Code-style
  JSON with comments. Then runs verify.
- `verify`: a scan of this account plus every other profile under C:\Users,
  checked for the same known secret locations (visible means a finding; denied
  is counted as blocked), the all-drive `.env` hunt (catches a `.env` every user
  can read) and any protection finish-setup should have applied.
- `remove-account`: you type the name to confirm. It only removes accounts
  whose Description marks them as created by Spare Room (unless --force), never
  an administrator and never the signed-in account. It reports the profile
  folder and how to delete it, but does not delete it.

### Checked against official docs
New-LocalUser limits (name up to 20 characters with a list of forbidden
characters, description up to 48, password up to 127; LocalAccounts is not
available in 32-bit PowerShell, so the code goes through Sysnative when Python
is 32-bit). Add-/Get-LocalGroupMember accept -SID. Well-known SIDs. VS Code,
npm and Claude Code setting names.
Not verified, so not applied: **Gemini CLI** settings (docs page 404). The
Remove-LocalUser docs say nothing about profile folders, so remove-account
checks whether the folder still exists instead of assuming.

### Limits found
- Claude Code: a repo's own `.claude/settings.json` can set `disableAllHooks`
  back to false (stated in Anthropic's hooks docs). finish-setup says so and
  suggests `--settings '{"disableAllHooks": true}'` for untrusted repos.
- npm `ignore-scripts` does not stop scripts you start by name
  (`npm start`, `npm run dev`). This matters for the blank-lines trap in phase 4.
- Readability is judged with os.stat/os.access. On Windows, os.access does not
  read ACLs, so a file whose attributes are visible but whose data is denied
  would be called visible. **Phase 4 should add a proper ACL check**
  (GetFileSecurity + AccessCheck through ctypes, which never opens the file)
  before the twin run.

### Observed on the dev machine (read-only verify, not elevated)
Another local profile's Chrome and Edge `Login Data` and `Local State` were
readable from the `aweki` account (checked by opening them). Browser
passwords are also DPAPI-encrypted to their owner, but Windows normally blocks
this. Reported to the user; nothing was changed.

### Tests (now 76 passing)
- `test_accounts.py`: name rules; quoting; the generated scripts (no password
  handling in Python, SIDs, marker and admin checks); **both scripts parse with
  PowerShell's own parser**; live `Get-LocalUser` for a missing name; admin
  detection from `whoami /groups`; the setup and remove CLI flows with a faked
  elevated step (happy path, declined, existing name, UAC declined, wrong
  typed name, refusal, profile cleanup text).
- `test_hardening.py`: JSON with comments; fresh and existing settings files;
  backups; unreadable file left alone; npm token line kept and never echoed;
  Claude permissions merged; finish-setup refuses an admin account.
- `test_verify.py`: profile filtering; readable files in another profile become
  findings; denied ones are counted as blocked; verify end to end on a temp
  machine; missing hardening is flagged.
- The no-network test now also covers verify, hardening and accounts.

## Next: Phase 4 - all traps, twin-run harness, coverage table, EVALUATION.md.
   First: run docs/VM_TEST_PHASE3.md on a VM and record the times.
