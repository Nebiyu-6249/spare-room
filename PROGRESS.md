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

## Phase 4 - traps, twin run, coverage, EVALUATION.md (PARTLY DONE)

Done: the parts that only check, map or report.

- **Readability from permissions** (`spareroom/access.py`). On Windows it reads
  the file's security descriptor and asks AccessCheck whether this process's
  own token may read it. Data is never read. The probe, verify and the `.env`
  hunt use it. Tested with a deny-read ACE, where os.access still says
  readable. Re-checked on the dev machine: the other profile's browser stores
  are genuinely readable from this account.
- **Coverage table** (`spareroom/coverage.py`): 36 documented targets from
  Unit 42 (2023 and 2024), GitGuardian, StepSecurity, MITRE S9008, Socket and
  MITRE T1552.003 / T1555.003. 25 are covered by a check; each of the 11 that
  are not gives its reason. Tests check that every check id exists, every
  source is a cited URL, and the table in EVALUATION.md is current.
- **EVALUATION.md outline**: the generated coverage table, scan timings from
  the dev machine, limits, and placeholders for the trap matrix and VM setup
  times.

Not started, waiting on a decision with the user:
- The **trap fixtures** for npm preinstall, the code after 1,000 blank lines,
  Python setup.py and the Claude Code startup hook. The VS Code trap from
  phase 1 exists.
- The **twin-run harness**, and in particular how the fake secrets get into
  the normal account for the test. Two attempts to write this were stopped by
  a safety check, so the approach is being agreed first.

Still pending from phase 3: run docs/VM_TEST_PHASE3.md on a VM and record the times.

Tests: 86 passing.

## Final stretch (user's decisions of 2026-11-04 override earlier plans)

- Twin run: the existing probe, run once in each account against a copy of the
  bundled fake laptop at `C:\Users\<me>\SpareRoomTest\fake_laptop`. Nothing is
  written to real credential locations. Results go to `C:\SpareRoomShared\results`.
- The other four trap fixtures are not built; the README describes them in
  plain words with links.
- npm `ignore-scripts`, confirmed in npm 11.20.0's own config definitions
  (the source of its docs): npm start, stop, restart, test and run "will still
  run their intended script", but not pre- or post-scripts. This goes in the
  README limitations.

### Skipped after a safety stop (not retried, per the user's rule)
- A response at the start of this stretch was stopped by a safety check, and
  which step it was could not be told. Skipped as the likely ones: re-running
  the readability check on another person's profile (item 4); and Claude
  creating the account or running commands as the interview user. The user
  runs those commands themselves (they approve UAC and type the password).
- Earlier in phase 4, writing a harness that plants fake files in real
  credential locations was stopped twice. Replaced by the fake-laptop-copy design.

### Done in this stretch
- Twin-run tooling (`spareroom probe`, `--fake-laptop`, `verify --only-profile`,
  `matrix.py`). Normal-account run recorded, not elevated: 13 of 13 visible.
- `dist/spareroom.exe` (PyInstaller 6.22.3, one file, unsigned) and
  `dist/SHA256SUMS.txt`, built by `packaging/build_exe.py`. Smoke-tested:
  --version, scan --demo, probe, setup --help.

### Skipped after a safety stop: the web walkthrough component
- Writing the three-step walkthrough for `/` ("Open the test assignment",
  "Create interview account", "Open it again") was stopped by a safety check.
  Per the user's rule it was not retried or rephrased. `/` is instead a short
  overview of the recorded results that links to Results, Privacy and Download.

### Phases 5 and 6 (DONE)
- Browser demo: https://spare-room-demo.netlify.app (Netlify site
  `spare-room-demo`, static export of `web/`). The site inherited the team's
  "Netlify team login" protection; it was switched off for this one site only.
  The team default and the other sites are unchanged. Checked live at 375 px:
  no page overflow, own CSP and no-referrer served, the only resource host is
  the site itself, no cookies.
- Repo: https://github.com/Nebiyu-6249/spare-room (public). Before the first
  push, a redacted local project name was rewritten out of the unpushed local
  history (git filter-branch). Commits cited in EVALUATION.md were unaffected.
- Release v0.1.0: `spareroom.exe` and `SHA256SUMS.txt`
  (a25a4868b894afd6fbc5db9abcb18f7121ce1cc40a7b1958517c0c77d33722a7);
  re-downloaded and verified.
- README (with limits and plain-word trick descriptions), DEVPOST.md with
  [PLACEHOLDER] spots, and `demo-video/spare-room-walkthrough.mp4` (2:49,
  captions burned in, plus .srt), recorded by `tools/video/record.mjs`.

### Left for the user
- Fill the [PLACEHOLDER] spots in DEVPOST.md; upload the video and paste its link.
- Optional: time the first sign-in to the interview account; do the VS Code
  hands-on check in that account.
- Optional: add a LICENSE if you want others to reuse the code.
- Decide whether to keep or remove the interview account.

### Release v0.1.1 (2026-11-04)
- Adds `spareroom doctor` (run inside the spare room; lists node, npm, python,
  git and code, with all-users install advice for anything missing) and the
  four corrected fix messages. Exe SHA-256
  4dd6adb47175c721343b126fd44a4ef315791d6c8b16b455389603d069a809fb,
  re-downloaded and verified. The site's Download page shows it.
- Recorded in the spare room on this machine: Node.js, npm, Git available
  (all users); Python and VS Code missing (installed for the normal account only).
- The copy in C:\Program Files\Spare Room is still 0.1.0 (replacing it needs
  admin); C:\SpareRoomShared\spareroom.exe is 0.1.1.

### Real demo video (in progress)
- The old site walkthrough (`demo-video/spare-room-walkthrough.*`,
  `tools/video/record.mjs`) is deleted; it showed an earlier layout.
- `tools/record_demo.ps1` (run by the user, not elevated) opens two titled
  console windows, "Your account" and "The spare room" (the latter via
  Start-Process -Credential from a Get-Credential prompt; the password is never
  handled by the scripts), and records only those windows with ffmpeg gdigrab
  by title. It uses only demo data and the fake laptop. A dry run on this machine
  confirmed window-only capture at 150% display scaling (needs
  __COMPAT_LAYER=HighDpiAware for ffmpeg).
- EVALUATION.md now has the doctor result from the interview account.
- Recorded on 2026-11-04 by the user running tools/record_demo.ps1 once.
  Edited by tools/video/edit.mjs into web/public/real-demo.mp4 (1:17.5,
  1920x1080 H.264, 30 fps, captions burned in) and web/public/real-demo.vtt.
  The report window was re-recorded by Claude (no password involved) after the
  first take came out black: browser windows are captured by their screen
  rectangle, because gdigrab cannot read GPU-drawn windows.
- The verify step's real project folder name is covered with <project> on
  every frame where it appears; the cut points are calibrated from the frames,
  so no frame shows it. Checked frame by frame at the boundaries, and every 5 s.

### Final video and polish round (2026-11-05)
- Re-recorded by the user with tools/record_demo.ps1: the VS Code trap (Trust,
  then Allow, task prints 13 reachable), the offline beat (Wi-Fi off, ping
  fails, `scan --demo` completes, Wi-Fi on) and the spare room (whoami,
  doctor, probe 13 blocked, verify in three groups).
- tools/video/edit.mjs rewritten: web/public/real-demo.mp4 is 1:51, 1920x1080,
  captions burned in, plus real-demo.vtt (13 cues) and real-demo-poster.jpg
  (the title card, now the video's poster on the home page). Cut points are
  calibrated from the frames; the real project folder shows as <project> on
  every frame, and the sped-up verify segment ends before any output appears.
- Frame check every 3 s: numbers match captions, no caption over two lines,
  nothing personal. Known and accepted: two long fake-laptop paths soft-wrap in
  the VS Code terminal (still readable).
- docs/narration.md: optional timed first-person narration and Sound Recorder
  steps. Captions only unless the user sends audio.
- 108 tests pass; Playwright and axe clean at 390 and 1440; deployed.
