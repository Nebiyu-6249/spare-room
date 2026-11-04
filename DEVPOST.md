# Spare Room: Devpost submission draft

Fill every `[PLACEHOLDER]` with your own words. The factual parts are taken
from EVALUATION.md and can be kept as they are.

## Tagline

[PLACEHOLDER: one line, under 200 characters, in your own words]

## Inspiration

[PLACEHOLDER: why you built this. For example, your own experience with take-home
tests or freelance repos, or someone you know who was targeted.]

## What it does

Spare Room is a Windows tool for developers about to run code from a recruiter
or client. It:

1. **Shows what that code could reach right now.** `scan` checks the places
   public attacker reports say this malware goes after (SSH keys, cloud
   credentials, npm and GitHub tokens, `.env` files on every drive, crypto
   wallets, browser password stores, AI tool sign-ins, shell history) and lists
   them with paths, reasons and fixes, without ever reading a secret value.
2. **Creates a separate standard Windows account** in about 30 seconds, with
   safer VS Code, npm and Claude Code settings, so stranger code runs away from
   your keys and wallets.
3. **Proves the difference.** The same harmless probe, run from both accounts
   against the same fake secrets, reached 13 of 13 from the normal account and
   0 of 13 from the interview account.

Everything works offline. No AI calls, no telemetry, no sign-in.

## How we built it

- Python 3.12, standard library only, packaged as one unsigned `.exe` with
  PyInstaller (SHA-256 checksum on the release).
- Account creation through one UAC-elevated Windows PowerShell script
  (`New-LocalUser`, groups addressed by well-known SID). The password is typed
  in that window and never passes through the tool.
- Readability is decided from Windows file permissions (`GetFileSecurity` and
  `AccessCheck`), so the tool never has to open a file to know whether it is exposed.
- Every scanned location cites a public report (Unit 42, GitGuardian,
  StepSecurity, Socket, MITRE ATT&CK) or an official doc.
- A Next.js static site replays output recorded on a test machine.
- Built with Claude Code as a coding assistant. [PLACEHOLDER: how you worked
  with it, in your words]

## Challenges we ran into

[PLACEHOLDER: in your words. Facts you can draw on:
- Python 3.12's `tempfile.mkdtemp` folder made the elevated step's result file
  unreadable; the first real `setup` run created the account and then crashed.
- `Path.exists()` raises on "access denied" in Python 3.12, so the probe
  crashed on exactly the case it exists to record.
- `os.access` on Windows ignores permissions; replaced with a real ACL check.
- `Start-Process -Credential` was refused for an account that had never signed in.]

## Accomplishments that we're proud of

[PLACEHOLDER: in your words. Numbers you can use:
- 13 of 13 versus 0 of 13 fake secrets reachable, recorded from real runs.
- Interview account created in 29.6 s.
- 25 of 36 documented attacker targets covered, each cited.
- Tests prove no secret value ever appears in output, and no network code exists.]

## What we learned

[PLACEHOLDER]

## What's next for Spare Room

[PLACEHOLDER: for example, Firefox and hardware-wallet coverage, a code-signed
build, a VM option, macOS and Linux account setup.]

## Built with

python, powershell, pyinstaller, pytest, next.js, typescript, tailwindcss, netlify, claude-code

## Links

- Live demo: https://spare-room-demo.netlify.app
- Code: https://github.com/Nebiyu-6249/spare-room
- Release: https://github.com/Nebiyu-6249/spare-room/releases/latest
- Video: [PLACEHOLDER: upload demo-video/spare-room-walkthrough.mp4 and paste the link]
