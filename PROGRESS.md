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

## Next: Phase 3 - setup, finish-setup, verify, remove-account.
   Needs admin/UAC and a standard account; test in a VM or spare machine, never
   the main one. Ask before running anything that needs admin on a real machine.
