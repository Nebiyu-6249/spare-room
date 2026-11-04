"""Export the recorded test-machine results for the browser demo (web/data).

Reads the real output in C:\\SpareRoomShared\\results and a fresh `scan --demo`,
and writes redacted JSON only:
  - fake-laptop paths become the fake laptop's own C:\\Users\\testdev\\... view
  - the fake-laptop copy inside the normal profile becomes <fake_laptop>
  - verify is reduced to its totals; a readable .env outside any profile is
    shown as C:\\dev\\<project>\\.env style, with folder names hidden
  - no real user name, and nothing from anyone else's profile

  python packaging/export_recorded.py [--results DIR]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path, PureWindowsPath

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from spareroom import TOOL_VERSION  # noqa: E402
from spareroom import coverage  # noqa: E402
from spareroom.matrix import build, redact_result  # noqa: E402
from spareroom.scanner import scan  # noqa: E402
from spareroom.traps import bundled_fake_laptop  # noqa: E402

OUT = ROOT / "web" / "data"


def _load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8-sig"))


def fake_view(path: str, base: Path) -> str:
    """C:\\...\\fake_laptop\\C\\Users\\testdev\\x -> C:\\Users\\testdev\\x"""
    b = str(base)
    if not path.lower().startswith(b.lower()):
        return "<outside fake laptop>"
    rest = PureWindowsPath(path[len(b):].lstrip("\\/"))
    drive, *parts = rest.parts
    return str(PureWindowsPath(f"{drive}:\\", *parts))


def outside_profile_hint(path: str) -> str:
    """C:\\dev\\myproject\\.env -> C:\\dev\\<project>\\.env (top folder kept, the rest hidden)."""
    p = PureWindowsPath(path)
    parts = list(p.parts)
    if len(parts) <= 3:
        return str(p)
    return str(PureWindowsPath(parts[0], parts[1], "<project>", parts[-1]))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--results", default=r"C:\SpareRoomShared\results")
    ap.add_argument("--release-sums", metavar="FILE",
                    help="SHA256SUMS.txt of a newly published release, to update the Download page's checksum")
    args = ap.parse_args(argv)
    res = Path(args.results)
    OUT.mkdir(parents=True, exist_ok=True)
    fake_copy = Path(os.environ["USERPROFILE"]) / "SpareRoomTest" / "fake_laptop"
    bundled = bundled_fake_laptop()

    # 1. scan --demo on the bundled fake laptop.
    report = scan("demo", account_label="demo").to_dict()
    for f in report["findings"]:
        f["path"] = fake_view(f["path"], bundled)
    (OUT / "scan_demo.json").write_text(json.dumps(report, indent=2), encoding="utf-8")

    # 2. The VS Code trap's probe against the bundled fake laptop (normal account).
    vs = _load(res / "vscode_demo.json")
    vs["visible"] = [fake_view(p, bundled) for p in vs["visible"]]
    vs["blocked"] = [fake_view(p, bundled) for p in vs["blocked"]]
    (OUT / "trap_vscode_demo.json").write_text(json.dumps(vs, indent=2), encoding="utf-8")

    # 3. Twin run, both accounts, and the matrix.
    normal, interview = _load(res / "normal.json"), _load(res / "interview.json")
    matrix = build(fake_copy, [normal, interview])
    twin = {"normal": redact_result(normal, fake_copy), "interview": redact_result(interview, fake_copy),
            "matrix": matrix}
    (OUT / "twin_run.json").write_text(json.dumps(twin, indent=2), encoding="utf-8")

    # 4. Setup timing (no secrets in it) and the verify totals.
    setup = _load(res / "setup.json")
    v = _load(res / "verify.json")
    outside = [outside_profile_hint(f["path"]) for f in v["findings"]
               if f["category"] == "env_file" and f["kind"] == "environment file"
               and not PureWindowsPath(f["path"]).parts[1:2] == ("Users",)]
    verify = {
        "account_label": "interview",
        "ran_at": v["started_at"],
        "duration_ms": v["duration_ms"],
        "locations_checked": v["locations_checked"],
        "normal_profile_secret_locations": v.get("blocked_in_other_profiles", 0),
        "normal_profile_readable": sum(1 for f in v["findings"] if f["id"].startswith("xprofile")),
        "readable_env_outside_profiles": outside,
        "hardening_missing": [f["kind"] for f in v["findings"] if f["kind"].startswith("not applied")],
    }
    acct = {"setup_wall_s": setup.get("wall_s"), "setup_elevated_ms": setup.get("elapsed_ms") or setup.get("elevated_ms"),
            "is_admin": setup.get("is_admin"), "verify": verify}
    (OUT / "account.json").write_text(json.dumps(acct, indent=2), encoding="utf-8")

    # 5. Coverage and meta.
    cov = [dict(item.to_dict(), note=row[3]) for item, row in zip(coverage.items(), coverage.ROWS)]
    (OUT / "coverage.json").write_text(json.dumps(cov, indent=2), encoding="utf-8")
    # The Download page must show the checksum of the *published* release, not
    # whatever is in dist/ right now: keep the current one unless the sums file
    # of a new release is passed explicitly.
    old_meta = OUT / "meta.json"
    old_sha = json.loads(old_meta.read_text(encoding="utf-8")).get("sha256") if old_meta.exists() else None
    meta = {"tool_version": TOOL_VERSION, "recorded_on": normal["ran_at"][:10],
            "machine": "Windows 11 Home laptop (test machine)"}
    if args.release_sums:
        meta["sha256"] = Path(args.release_sums).read_text(encoding="utf-8").split()[0]
    elif old_sha:
        meta["sha256"] = old_sha
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    # 6. doctor, as recorded inside the spare room (optional). Paths are dropped.
    doc = res / "doctor.json"
    if doc.exists():
        d = _load(doc)
        keep = ("name", "label", "found", "scope", "version", "note", "install")
        out = {"ran_at": d["ran_at"], "tools": [{k: t.get(k) for k in keep} for t in d["tools"]]}
        (OUT / "doctor.json").write_text(json.dumps(out, indent=2), encoding="utf-8")

    # Guard: the real user name never reaches the published data.
    user = os.environ.get("USERNAME", "").lower()
    for f in OUT.glob("*.json"):
        if user:
            assert user not in f.read_text(encoding="utf-8").lower(), f"user name found in {f.name}"
    print(f"Wrote {len(list(OUT.glob('*.json')))} files to {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
