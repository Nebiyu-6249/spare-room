"""The one probe every trap calls.

It only checks whether listed paths exist and are readable. It never opens their
contents and never uses the network. It prints results and writes a local JSON
TrapResult. Readability is tested with os.access(R_OK), so no file is ever
opened or read.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
from pathlib import Path
from typing import List, Tuple

from .access import BLOCKED, VISIBLE, path_state


def check_paths(paths: List[str]) -> Tuple[List[str], List[str]]:
    """Return (visible, blocked). A path that is absent is simply omitted.

    visible  - present and readable from this account
    blocked  - access denied: present but not readable, or inside a folder this
               account may not look into (so it cannot tell if the file exists)
    Only metadata and permissions are queried (see access.py); contents are never read.
    """
    visible: List[str] = []
    blocked: List[str] = []
    for p in paths:
        state = path_state(p)
        if state == VISIBLE:
            visible.append(str(Path(p)))
        elif state == BLOCKED:
            blocked.append(str(Path(p)))
    return visible, blocked


def run(trap_id: str, trigger: str, paths: List[str], account_label: str) -> dict:
    visible, blocked = check_paths(paths)
    return {
        "trap_id": trap_id,
        "trigger": trigger,
        "account_label": account_label,
        "visible": visible,
        "blocked": blocked,
        "ran_at": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    }


def _demo_targets(base: str = None) -> List[str]:
    # Imported lazily so the probe stays usable on its own.
    from .traps import demo_targets
    return [str(p) for p in demo_targets(Path(base) if base else None)]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="spareroom-probe",
                                 description="Check whether listed paths exist and are readable. Reads no contents; no network.")
    ap.add_argument("--demo", action="store_true", help="probe the bundled fake laptop's planted paths")
    ap.add_argument("--fake-laptop", metavar="DIR", help="probe a copy of the fake laptop at DIR")
    ap.add_argument("--targets", metavar="FILE", help="JSON file: a list of paths to check")
    ap.add_argument("--trap-id", default="manual", help="id recorded in the result")
    ap.add_argument("--trigger", default="manual run", help="how this probe was triggered")
    ap.add_argument("--account", default=os.environ.get("USERNAME", ""), help="account label for the result")
    ap.add_argument("--out", metavar="FILE", help="write the TrapResult JSON here")
    args = ap.parse_args(argv)

    if args.targets:
        paths = json.loads(Path(args.targets).read_text(encoding="utf-8"))
    elif args.fake_laptop:
        paths = _demo_targets(args.fake_laptop)
    elif args.demo:
        paths = _demo_targets()
    else:
        print("Give --demo, --fake-laptop DIR or --targets FILE.", file=sys.stderr)
        return 2

    result = run(args.trap_id, args.trigger, paths, args.account)
    label = lambda p: p
    where = None
    if args.fake_laptop or args.demo:
        # Show paths relative to the fake laptop so they fit on one line; the
        # JSON written with --out keeps the full paths.
        from .scanner import demo_roots, fake_laptop_label
        from .traps import bundled_fake_laptop
        base = Path(args.fake_laptop) if args.fake_laptop else bundled_fake_laptop()
        home, _ = demo_roots(base)
        label = lambda p: fake_laptop_label(p, home, base)
        where = str(base) if args.fake_laptop else "bundled with the tool"
    print(f"Probe {result['trap_id']} ({result['trigger']}) as {result['account_label'] or '(unknown)'}:")
    if where:
        print(f"  fake laptop: {where}")
    print(f"  visible: {len(result['visible'])}   blocked: {len(result['blocked'])}")
    for v in result["visible"]:
        print(f"    visible  {label(v)}")
    for b in result["blocked"]:
        print(f"    blocked  {label(b)}")
    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=2), encoding="utf-8")
        print(f"  wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
