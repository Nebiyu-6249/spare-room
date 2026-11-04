"""Command-line entry point for Spare Room.

Phase 1 implements `scan` and `report`. The account commands (`setup`,
`finish-setup`, `verify`, `remove-account`) are declared here so the surface is
visible, but they are built in a later phase and say so when run.
"""

from __future__ import annotations

import argparse
import json
import sys
import webbrowser
from pathlib import Path

from . import APP_NAME, TOOL_VERSION
from .report import write_report
from .scanner import scan

_NOT_YET = ("setup", "finish-setup", "verify", "remove-account")


def _print_summary(report) -> None:
    counts = {"high": 0, "medium": 0, "info": 0}
    for f in report.findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1
    total = len(report.findings)
    mode = "demo (fake laptop)" if report.mode == "demo" else "real"
    print(f"{APP_NAME} {TOOL_VERSION} - {mode} scan")
    print(f"Checked {report.locations_checked} locations in {report.duration_ms} ms.")
    if total == 0:
        print(f"Nothing found in the {report.locations_checked} places checked.")
        return
    print(f"{total} things stranger code could reach "
          f"({counts['high']} high, {counts['medium']} medium, {counts['info']} info):")
    for f in sorted(report.findings, key=lambda x: {"high": 0, "medium": 1, "info": 2}.get(x.severity, 9)):
        print(f"  [{f.severity:<6}] {f.category:<17} {f.kind}")
        print(f"            {f.path}")


def cmd_scan(args) -> int:
    mode = "demo" if args.demo else "real"
    report = scan(mode=mode, account_label=args.account or "")
    _print_summary(report)
    if args.json:
        out = Path(args.json)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(report.to_dict(), indent=2), encoding="utf-8")
        print(f"\nJSON written to {out}")
    return 0


def cmd_report(args) -> int:
    mode = "demo" if args.demo else "real"
    report = scan(mode=mode, account_label=args.account or "")
    _print_summary(report)
    out = Path(args.out) if args.out else (Path.cwd() / "spareroom-report.html")
    path = write_report(report, out)
    print(f"\nReport written to {path}")
    if not args.no_open:
        try:
            webbrowser.open(path.resolve().as_uri())
        except Exception:
            print("(Could not open a browser automatically; open the file above.)")
    return 0


def cmd_not_yet(args) -> int:
    print(f"'{args._command}' is part of the interview-account workflow and is built in a later phase.")
    print("This phase ships 'scan' and 'report'. Try: spareroom scan --demo")
    return 2


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="spareroom", description=f"{APP_NAME}: see what stranger code could reach, and run it somewhere safer.")
    p.add_argument("--version", action="version", version=f"{APP_NAME} {TOOL_VERSION}")
    sub = p.add_subparsers(dest="command", required=True)

    sp = sub.add_parser("scan", help="scan this account and list what code could reach")
    sp.add_argument("--demo", action="store_true", help="scan the bundled fake laptop instead of the real machine")
    sp.add_argument("--json", metavar="PATH", help="also write the report as JSON to PATH")
    sp.add_argument("--account", metavar="LABEL", help="label for this account in the report")
    sp.set_defaults(func=cmd_scan)

    rp = sub.add_parser("report", help="scan, write a local HTML report, and open it")
    rp.add_argument("--demo", action="store_true", help="scan the bundled fake laptop instead of the real machine")
    rp.add_argument("--out", metavar="PATH", help="where to write the HTML (default: ./spareroom-report.html)")
    rp.add_argument("--no-open", action="store_true", help="do not open a browser")
    rp.add_argument("--account", metavar="LABEL", help="label for this account in the report")
    rp.set_defaults(func=cmd_report)

    for name in _NOT_YET:
        np = sub.add_parser(name, help="(interview-account workflow; built in a later phase)")
        np.set_defaults(func=cmd_not_yet, _command=name)

    return p


def main(argv=None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
