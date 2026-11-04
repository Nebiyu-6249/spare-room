This trap is harmless: it only checks whether listed paths exist and are readable, prints the result and writes local JSON. It never opens file contents and never uses the network.

# VS Code folder-open trap

## The trick it demonstrates
A malicious repository ships a `.vscode/tasks.json` with
`"runOptions": { "runOn": "folderOpen" }`. When the victim opens the folder in
VS Code and trusts the workspace, the task runs automatically with no further
click. This is the mechanism used by the DPRK "Contagious Interview" campaign to
launch BeaverTail/InvisibleFerret from a take-home assignment.

Sources:
- VS Code tasks documentation (runOn: folderOpen, task.allowAutomaticTasks):
  https://code.visualstudio.com/docs/debugtest/tasks
- VS Code Workspace Trust:
  https://code.visualstudio.com/docs/editing/workspaces/workspace-trust
- Contagious Interview abuse of VS Code tasks:
  https://unit42.paloaltonetworks.com/north-korean-threat-actors-lure-tech-job-seekers-as-fake-recruiters/

## What this fixture does instead
The `tasks.json` here runs Spare Room's probe against the bundled fake laptop,
from the repository root two folders up (so it needs this repo and Python 3.12):

    python -m spareroom.probe --demo --trap-id vscode_task --trigger "folderOpen" --out trap-result.json

The probe lists which planted (fake, marked FAKE-DEMO) paths are reachable. In
the normal account they are visible; in the interview account they are not. The
real campaign would instead download and run a payload here.

## Safe to open
Opening this folder in VS Code will, at most, run the harmless probe above and
write `trap-result.json`. Nothing is downloaded, nothing is deleted, no contents
are read. You can also run the command yourself without VS Code.
