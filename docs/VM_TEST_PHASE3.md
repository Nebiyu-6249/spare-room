# Phase 3 test on a VM or spare machine

Run this on a Windows 11 Home VM or a spare machine, never your main one.
`setup` and `remove-account` create and delete a real Windows account.
Write down the times; they go into EVALUATION.md.

## 0. Prepare (as the admin account)
1. Install Python 3.12 with **"Install for all users"** ticked (it lands in
   `C:\Program Files\Python312`). A per-user Python cannot be started from the
   interview account.
2. Copy this repo to `C:\SpareRoomTest` (any folder outside your profile works,
   so the interview account can read it).
3. Plant fakes so `verify` has something to catch:
   ```powershell
   New-Item -ItemType Directory -Force $env:USERPROFILE\.ssh | Out-Null
   Set-Content $env:USERPROFILE\.ssh\id_rsa 'FAKE-DEMO placeholder'
   New-Item -ItemType Directory -Force C:\SpareRoomTest\shared | Out-Null
   Set-Content C:\SpareRoomTest\shared\.env 'FAKE_KEY=FAKE-DEMO'
   ```
   The first should be **blocked** from the interview account. The second is
   readable by every user, so `verify` should **list** it.
4. `cd C:\SpareRoomTest` then `python -m pip install pytest` and `python -m pytest`. All tests should pass.

## 1. setup (start a stopwatch)
```powershell
python -m spareroom setup --json C:\SpareRoomTest\setup.json
```
- Accept the default name `interview`, answer `y`, approve the UAC prompt.
- In the PowerShell window, enter a password twice.
- Expect: "Created 'interview' in N s. It is a standard user, not an administrator."
- Check:
  ```powershell
  Get-LocalUser interview | Format-List Name,Description,Enabled
  Get-LocalGroupMember -SID S-1-5-32-544   # interview must NOT be listed
  Get-LocalGroupMember -SID S-1-5-32-545   # interview must be listed
  ```
Record: **setup wall time** (from setup.json `wall_s`).

## 2. First sign-in
Switch user to `interview` and sign in. Record **time to desktop**.

## 3. finish-setup (inside the interview account)
```powershell
cd C:\SpareRoomTest
python -m spareroom finish-setup --json C:\SpareRoomTest\finish.json
```
Expect:
- VS Code, npm and Claude Code each "updated", with the settings listed.
- "Gemini CLI: not changed".
- verify output: `C:\SpareRoomTest\shared\.env` listed as an env_file finding;
  **no** "another account's secret file is readable" findings; a non-zero
  "known secret locations in other accounts were out of reach" count (it
  counts the admin account's `.ssh\id_rsa`).
- Check these files:
  `%APPDATA%\Code\User\settings.json`, `%USERPROFILE%\.npmrc`,
  `%USERPROFILE%\.claude\settings.json`.
Record: **finish-setup time** (`settings_ms` plus the verify run).

Run `python -m spareroom verify` again; it should give the same result.

## 4. Refusals (quick)
- In the admin account: `python -m spareroom finish-setup`. It should refuse ("This account is an administrator").
- `python -m spareroom setup --username interview --yes`. It should say the account already exists.
- `python -m spareroom setup --username interview2`, then choose **No** on the UAC prompt.
  It should say "declined. Nothing was changed."

## 5. remove-account (back in the admin account; sign the interview account out first)
```powershell
python -m spareroom remove-account
```
- Type `interview` to confirm and approve UAC.
- Expect "Removed the account 'interview'", then the profile folder path and
  cleanup instructions. Windows normally keeps the folder.
- `Get-LocalUser interview` should now fail.
- Try `python -m spareroom remove-account --username <your admin name> --yes`.
  It must refuse.

## Report back
- setup.json, finish.json
- The three times: setup wall, first sign-in, finish-setup
- Any output that differed from the above
