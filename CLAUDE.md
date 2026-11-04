# Spare Room (working name: keep it in one constant, APP_NAME)

## What we're building
A Windows tool for developers about to run code from a recruiter or client (take-home tests, "fix this repo" gigs). It shows what that code could reach on their laptop right now, creates a separate standard "interview" account in minutes so stranger code runs away from their keys and wallets, and proves the difference by running the same harmless trap in both accounts. Fully offline. Entry for SafeSpace Hacks (deadline Nov 22, 2026, 5:00 PM ET); judges see it through a video, a browser demo and a safe demo mode.

## Success criteria
1. `scan` finishes in under 60 s on Windows 11 and lists findings by category with paths. No secret value ever appears in output, logs or report files (tested with planted fake values).
2. Scanner, probe and report contain no network code (automated test) and work with Wi-Fi off. The HTML report loads nothing external.
3. `setup` creates a standard (non-admin) local account; `finish-setup`, run once inside it, applies safe editor and npm settings. Under 5 minutes total on Windows 11 Home.
4. Every trap fires in the normal account and reports the planted secrets it can see; in the interview account it sees none of them.
5. `verify`, run inside the interview account, lists anything still reachable from there (for example a `.env` on `D:\` readable by all users).
6. `scan --demo` and trap demo mode need no admin rights and touch only the bundled fake laptop folder.
7. The browser demo replays real recorded output, works at phone width, has no analytics.
8. EVALUATION.md has the trap-by-secret matrix for both accounts, a coverage table against public attacker target lists with links, and measured setup times.

## Stack
- Tool: Python 3.12, standard library only unless I agree otherwise. PowerShell (`New-LocalUser`, `Add-LocalGroupMember`) for account creation, elevated through UAC only for `setup`. Shipped as one `.exe` via PyInstaller, with SHA-256 checksums on GitHub Releases.
- Tests: pytest.
- Browser demo: Next.js + TypeScript + Tailwind, static export on Netlify. No API routes, database or env vars.
- No AI calls and no API keys anywhere.

## Data model (JSON)
- Finding: id, category (ssh | cloud | token | env_file | wallet_extension | desktop_wallet | browser_store | ai_tool | shell_history | editor_setting), path, kind, severity (high | medium | info), reason, fix, source_ref (public report URL)
- ScanReport: tool_version, mode (real | demo), account_label, started_at, duration_ms, locations_checked, findings[]
- TrapResult: trap_id, trigger, account_label, visible[], blocked[], ran_at
- CoverageItem: attacker_source (name, url), target, check_id | null

## Routes and screens
- CLI: `scan [--demo] [--json PATH]`, `report` (writes and opens local HTML), `setup` (admin), `finish-setup` and `verify` (inside the new account), `remove-account` (admin, confirms, explains profile cleanup).
- Local report: one headline count, then findings by category, each with path, why it matters and the fix.
- Web demo: `/` fake-laptop walkthrough (Open the test assignment, Create interview account, Open it again), `/results` (matrix and coverage), `/privacy` (exactly what it reads, what it never does), `/download`.

## Core flows
- Scan: check known locations (profile folders; all fixed drives for `.env`, skipping node_modules). Classify by file name, header bytes and key-name patterns, reading only what classification needs; never store or print values. Permission errors become "could not check", never a crash. Never say safe: "Nothing found in the N places checked."
- Interview account: `setup` asks for a username and password, creates a standard account and explains that Windows builds the profile at first sign-in. `finish-setup` turns on VS Code Workspace Trust, turns off automatic tasks, sets npm ignore-scripts and the equivalent AI-tool settings, then runs `verify`.
- Twin run: a harness runs every trap in both accounts and writes TrapResults.
- Traps (`/traps`, harmless fixtures), one per documented trick: VS Code task on folder open, npm `preinstall`, code after 1,000 blank lines run by `npm run dev`, Python `setup.py`, Claude Code startup hook. Each calls one probe that only checks whether listed paths exist and are readable. It never opens contents or uses the network; it prints results and writes local JSON. Each trap's README says this in its first line.

## Design direction
Calm and factual, like a medical test report: one big number, short plain sentences, monospace paths. IBM Plex Sans and Plex Mono on the web demo; system fonts in the local report. Light background, ink text, one accent; severity as icon plus word. Avoid hacker looks (black-and-green, skulls, glitch), red alarm screens, gradients, glassmorphism, stock illustration and emoji.

## Build order
Stop after each phase: run tests, commit, update PROGRESS.md, summarise, wait for my go-ahead.
1. `scan --demo` on the bundled fake laptop, JSON, local HTML report, the VS Code trap firing against the demo folder, the no-network test. End to end.
2. Real scan on Windows for every category.
3. `setup`, `finish-setup`, `verify`, `remove-account`. Test in a VM or spare machine, never my main one.
4. All traps, twin-run harness, coverage table, EVALUATION.md.
5. Browser demo on Netlify driven by recorded JSON from the test machine.
6. Packaging, README (limitations; credits including Claude Code), DEVPOST.md with placeholders for my own words, demo video script.

## Out of scope for v1
macOS and Linux account setup; scanning repos for malicious code; real malware samples; live credential validation; uploads, telemetry or sign-in; deleting or moving secrets automatically; a GUI app; a browser extension; company dashboards; any AI feature.

## Notes for the agent
- Synthetic data only. Fake secrets are obviously fake (marked FAKE-DEMO) and must not trip GitHub push protection.
- Take wallet extension IDs, `.env` hunting rules and token locations from public reports (Unit 42 on BeaverTail and InvisibleFerret, Shai-Hulud write-ups, GitGuardian) and cite each in source_ref. Never invent IDs, paths or setting names; check VS Code, npm and Claude Code settings against current official docs, and ask if one doesn't exist.
- State the limits in README and the report: a separate account is weaker than a VM; malware with admin rights, folders readable by all users, and a shared network or VPN can still be reached.
- Windows and PowerShell first, cross-platform Python paths. No emoji in code, UI or commits. Start from an empty repo; copy nothing from my other projects. Ask before anything irreversible or anything needing admin on a real machine.
