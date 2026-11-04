"""Build the trap-by-secret matrix from recorded TrapResult files.

Reads only: the TrapResult JSON written by the probe in each account, and the
list of fake secrets in the fake laptop copy. Nothing is planted or changed.

  python -m spareroom.matrix --fake-laptop DIR normal.json interview.json \\
      [--json matrix.json] [--update EVALUATION.md]

Published output uses paths relative to the fake home, and any absolute path
is rewritten to start with <fake_laptop>, so no user name leaves the machine.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import List

from .traps import demo_target_rows

START, END = "<!-- matrix:start -->", "<!-- matrix:end -->"


def _norm(p: str) -> str:
    return str(Path(p)).lower()


def build(fake_laptop: Path, results: List[dict]) -> dict:
    rows = demo_target_rows(Path(fake_laptop))
    columns = []
    for r in results:
        visible = {_norm(p) for p in r.get("visible", [])}
        blocked = {_norm(p) for p in r.get("blocked", [])}
        cells = []
        for _, _, path in rows:
            key = _norm(str(path))
            cells.append("visible" if key in visible else "blocked" if key in blocked else "absent")
        columns.append({"trap_id": r["trap_id"], "trigger": r["trigger"],
                        "account_label": r["account_label"], "ran_at": r.get("ran_at", ""),
                        "cells": cells})
    return {"secrets": [{"category": c, "path": rel} for c, rel, _ in rows], "columns": columns}


def isolation_problems(matrix: dict, normal: str, interview: str) -> List[str]:
    """What breaks criterion 4: a fake secret the normal account cannot see, or
    one the interview account can."""
    problems = []
    by_label = {c["account_label"]: c for c in matrix["columns"]}
    for i, s in enumerate(matrix["secrets"]):
        if normal in by_label and by_label[normal]["cells"][i] != "visible":
            problems.append(f"{normal} cannot see {s['path']}")
        if interview in by_label and by_label[interview]["cells"][i] == "visible":
            problems.append(f"{interview} can see {s['path']}")
    return problems


def render_markdown(matrix: dict) -> str:
    cols = matrix["columns"]
    head = "| Category | Fake secret (relative to the fake home) | " + \
        " | ".join(f"{c['trap_id']} as {c['account_label']}" for c in cols) + " |"
    sep = "|---|---|" + "---|" * len(cols)
    lines = []
    for c in cols:
        n = len(c["cells"])
        v, b = c["cells"].count("visible"), c["cells"].count("blocked")
        lines.append(f"- **{c['account_label']}** ({c['ran_at']}): {v} of {n} visible, "
                     f"{b} blocked, {n - v - b} absent.")
    lines += ["", head, sep]
    for i, s in enumerate(matrix["secrets"]):
        lines.append(f"| {s['category']} | `{s['path']}` | " +
                     " | ".join(c["cells"][i] for c in cols) + " |")
    return "\n".join(lines) + "\n"


def redact_result(result: dict, fake_laptop: Path) -> dict:
    """A TrapResult safe to publish: absolute paths start with <fake_laptop>."""
    prefix = str(Path(fake_laptop))

    def fix(p: str) -> str:
        return "<fake_laptop>" + p[len(prefix):] if p.lower().startswith(prefix.lower()) else "<outside fake laptop>"

    out = dict(result)
    out["visible"] = [fix(p) for p in result.get("visible", [])]
    out["blocked"] = [fix(p) for p in result.get("blocked", [])]
    return out


def update_file(path: Path, markdown: str) -> None:
    text = path.read_text(encoding="utf-8")
    a, b = text.index(START) + len(START), text.index(END)
    path.write_text(text[:a] + "\n" + markdown + text[b:], encoding="utf-8")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="spareroom-matrix")
    ap.add_argument("--fake-laptop", required=True, metavar="DIR")
    ap.add_argument("results", nargs="+", help="TrapResult JSON files, one per account")
    ap.add_argument("--json", metavar="FILE", help="write the matrix as JSON")
    ap.add_argument("--update", metavar="FILE", help="rewrite the matrix between the markers in FILE")
    args = ap.parse_args(argv)
    results = [json.loads(Path(f).read_text(encoding="utf-8-sig")) for f in args.results]
    matrix = build(Path(args.fake_laptop), results)
    md = render_markdown(matrix)
    print(md)
    if args.json:
        Path(args.json).write_text(json.dumps(matrix, indent=2), encoding="utf-8")
    if args.update:
        update_file(Path(args.update), md)
    return 0


if __name__ == "__main__":
    sys.exit(main())
