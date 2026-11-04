"""Command-line entry point for Spare Room.

scan, report  - what code running as you could reach (no admin)
setup         - create the standard interview account (admin, through UAC)
finish-setup  - run once inside the interview account: safer editor/npm/AI defaults, then verify
verify        - run inside the interview account: what is still reachable from there
doctor        - run inside the interview account: which coding tools are available there
remove-account- remove the interview account (admin, through UAC; confirms first)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import webbrowser
from pathlib import Path

from . import APP_NAME, TOOL_VERSION
from . import accounts
from .hardening import apply_all
from .report import write_report
from .scanner import scan
from .verify import verify

LIMITS = ("A separate account is weaker than a virtual machine. Malware running with "
          "administrator rights, files every user can read, and your network or VPN "
          "can still be reached.")

# Indirection so tests can drive the prompts.
_ask = input


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


def _write_json(path, data) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"\nJSON written to {out}")


def _yes(prompt: str) -> bool:
    return _ask(prompt).strip().lower() in ("y", "yes")


# --- scan / report -----------------------------------------------------------

def cmd_scan(args) -> int:
    mode = "demo" if args.demo else "real"
    report = scan(mode=mode, account_label=args.account or "")
    _print_summary(report)
    if args.json:
        _write_json(args.json, report.to_dict())
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


# --- setup -------------------------------------------------------------------

def cmd_setup(args, elevate=accounts.run_elevated, exists=accounts.user_exists) -> int:
    if os.name != "nt":
        print("setup is Windows-only.")
        return 2
    print(f"{APP_NAME} setup\n")
    print("This creates a separate standard (non-admin) Windows account for running")
    print("code from recruiters and clients. Code run there cannot read the files in")
    print("your own account: SSH keys, cloud logins, browser passwords, wallets.")
    print("Windows will ask for permission, then a PowerShell window asks for the new")
    print("account's password. The password is not shown, saved or sent anywhere.\n")
    print("Limits: " + LIMITS + "\n")

    name = args.username
    while True:
        if not name:
            name = _ask(f"User name for the interview account [{accounts.DEFAULT_USERNAME}]: ").strip() \
                or accounts.DEFAULT_USERNAME
        try:
            name = accounts.validate_username(name, new=True)
            if exists(name):
                raise accounts.AccountError(f"An account named '{name}' already exists.")
            break
        except accounts.AccountError as e:
            print(e)
            if args.username:
                return 1
            name = None

    if not args.yes and not _yes(f"Create standard account '{name}'? [y/N]: "):
        print("Nothing was changed.")
        return 1

    t = time.monotonic()
    exe = accounts.frozen_executable()
    try:
        result = accounts.create_account(name, elevate=elevate, copy_from=exe)
    except accounts.AccountError as e:
        print(e)
        return 1
    if not result.get("ok"):
        print(f"Setup did not finish (step: {result.get('step')}): {result.get('error')}")
        return 1

    secs = (time.monotonic() - t)
    print(f"\nCreated '{name}' in {secs:.0f} s. It is a standard user, not an administrator.")
    if result.get("is_admin") is None:
        print("(Windows could not list the Administrators group; finish-setup checks again.)")
    print("\nNext:")
    print(f"  1. Switch user to '{name}' and sign in. Windows builds the profile at first")
    print("     sign-in, which takes a minute or two.")
    if result.get("tool_path"):
        print(f"  2. In that account run:  \"{result['tool_path']}\" finish-setup")
    else:
        print("  2. In that account run:  python -m spareroom finish-setup")
        print("     (Running from source: Python must be installed for all users, and the")
        print("     project folder must be somewhere that account can read.)")
    print("  3. Open and run the test assignment only in that account.")
    if args.json:
        _write_json(args.json, {"username": name, "wall_s": round(secs, 1),
                                "elevated_ms": result.get("elapsed_ms"),
                                "is_admin": result.get("is_admin")})
    return 0


# --- finish-setup / verify ---------------------------------------------------

def _admin_guard(force: bool, what: str, is_admin=accounts.current_account_is_admin) -> bool:
    """True if we may continue."""
    if is_admin():
        print(f"This account is an administrator. {what} is meant to run inside the")
        print("standard interview account created by setup.")
        if not force:
            print("Nothing was changed. Use --force to run it here anyway.")
            return False
    return True


def _print_verify(report, blocked: int) -> None:
    _print_summary(report)
    print(f"\n{blocked} known secret locations in other accounts were out of reach from here.")
    print("Limits: " + LIMITS)


def cmd_finish_setup(args, is_admin=accounts.current_account_is_admin) -> int:
    if not _admin_guard(args.force, "finish-setup", is_admin):
        return 1
    home = Path(os.environ.get("USERPROFILE") or os.path.expanduser("~"))
    t = time.monotonic()
    steps = apply_all(home)
    secs = time.monotonic() - t
    print(f"{APP_NAME} finish-setup for {home}\n")
    failed = False
    for s in steps:
        if s.error:
            failed = True
            print(f"  {s.name}: {s.error}")
        elif s.changes:
            print(f"  {s.name}: updated {s.path}")
            for c in s.changes:
                print(f"      {c}")
        else:
            print(f"  {s.name}: already set ({s.path})")
        if s.note:
            print(f"      {s.note}")
    print("\n  Gemini CLI: not changed (its settings could not be confirmed in the docs).")
    print(f"\nSettings done in {secs:.1f} s.\n")

    data = {"steps": [s.to_dict() for s in steps], "settings_ms": int(secs * 1000)}
    if not args.no_verify:
        report, blocked = verify()
        _print_verify(report, blocked)
        data["verify"] = report.to_dict()
        data["verify_blocked"] = blocked
    if args.json:
        _write_json(args.json, data)
    return 1 if failed else 0


def cmd_verify(args, is_admin=accounts.current_account_is_admin) -> int:
    if is_admin():
        print("Warning: this account is an administrator. verify is meant to run inside")
        print("the standard interview account; results here will look worse than they should.\n")
    only = args.only_profile or None
    report, blocked = verify(only_profiles=only)
    _print_verify(report, blocked)
    if args.json:
        data = report.to_dict()
        data["blocked_in_other_profiles"] = blocked
        data["only_profiles"] = only
        _write_json(args.json, data)
    return 0


def cmd_probe(args) -> int:
    from . import probe
    return probe.main(args.probe_args)


def cmd_doctor(args) -> int:
    from . import doctor
    results = doctor.check()
    print(f"{APP_NAME} doctor: coding tools in this account\n")
    doctor.print_report(results)
    if args.json:
        _write_json(args.json, doctor.report(results))
    return 0


# --- remove-account ----------------------------------------------------------

def cmd_remove_account(args, elevate=accounts.run_elevated) -> int:
    if os.name != "nt":
        print("remove-account is Windows-only.")
        return 2
    name = args.username or accounts.DEFAULT_USERNAME
    try:
        name = accounts.validate_username(name)
    except accounts.AccountError as e:
        print(e)
        return 1
    print(f"{APP_NAME} remove-account\n")
    print(f"This removes the Windows account '{name}'. Windows will ask for permission.")
    print(f"Only accounts created by {APP_NAME} are removed unless you pass --force;")
    print("administrator accounts are never removed.")
    print("The account's profile folder (its files) is not deleted by this command.\n")
    if not args.yes:
        typed = _ask(f"Type the account name to confirm ({name}): ").strip()
        if typed != name:
            print("Names did not match. Nothing was changed.")
            return 1
    try:
        result = accounts.remove_account(name, elevate=elevate, force=args.force)
    except accounts.AccountError as e:
        print(e)
        return 1
    if not result.get("ok"):
        print(f"Not removed (step: {result.get('step')}): {result.get('error')}")
        return 1
    print(f"Removed the account '{name}'.")
    profile = result.get("profile_path")
    if not profile:
        print("It never signed in, so Windows has no profile folder for it.")
    elif result.get("profile_exists"):
        print(f"\nWindows kept its profile folder: {profile}")
        print("To delete it (this permanently deletes everything in that folder):")
        print("  - System Properties > Advanced > User Profiles > Settings, select the")
        print("    'Account Unknown' entry and choose Delete; or")
        print("  - in an administrator PowerShell:")
        print(f"    Get-CimInstance Win32_UserProfile | Where-Object LocalPath -eq '{profile}' | Remove-CimInstance")
    else:
        print(f"Its profile folder {profile} is already gone.")
    return 0


# --- parser ------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="spareroom",
                                description=f"{APP_NAME}: see what stranger code could reach, and run it somewhere safer.")
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

    su = sub.add_parser("setup", help="create the standard interview account (asks for admin)")
    su.add_argument("--username", metavar="NAME", help=f"account name (default: {accounts.DEFAULT_USERNAME})")
    su.add_argument("--yes", action="store_true", help="skip the confirmation question")
    su.add_argument("--json", metavar="PATH", help="write timings and result (no password) as JSON")
    su.set_defaults(func=cmd_setup)

    fs = sub.add_parser("finish-setup", help="run once inside the interview account")
    fs.add_argument("--force", action="store_true", help="run even if this account is an administrator")
    fs.add_argument("--no-verify", action="store_true", help="skip the verify step at the end")
    fs.add_argument("--json", metavar="PATH", help="write what changed and the verify result as JSON")
    fs.set_defaults(func=cmd_finish_setup)

    ve = sub.add_parser("verify", help="run inside the interview account: what is still reachable")
    ve.add_argument("--json", metavar="PATH", help="write the result as JSON")
    ve.add_argument("--only-profile", metavar="NAME", action="append",
                    help="check only this other profile folder (repeatable); others are left alone")
    ve.set_defaults(func=cmd_verify)

    dr = sub.add_parser("doctor", help="inside the interview account: are node, npm, python, git and code available?")
    dr.add_argument("--json", metavar="PATH", help="write the result as JSON")
    dr.set_defaults(func=cmd_doctor)

    pr = sub.add_parser("probe", help="the trap probe: check whether listed paths are reachable",
                        add_help=False)
    pr.add_argument("probe_args", nargs=argparse.REMAINDER)
    pr.set_defaults(func=cmd_probe)

    ra = sub.add_parser("remove-account", help="remove the interview account (asks for admin, confirms first)")
    ra.add_argument("--username", metavar="NAME", help=f"account name (default: {accounts.DEFAULT_USERNAME})")
    ra.add_argument("--yes", action="store_true", help="skip typing the name to confirm")
    ra.add_argument("--force", action="store_true", help=f"allow removing an account not created by {APP_NAME}")
    ra.set_defaults(func=cmd_remove_account)

    return p


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else list(argv)
    if argv[:1] == ["probe"]:
        # The probe has its own options; hand them over untouched.
        from . import probe
        return probe.main(argv[1:])
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
