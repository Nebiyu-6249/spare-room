"""The web playground's rules are generated from the Python source, never hand-kept."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _exporter():
    spec = importlib.util.spec_from_file_location("export_rules", ROOT / "packaging" / "export_rules.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_committed_rules_json_matches_the_python_source():
    mod = _exporter()
    committed = mod.OUT.read_text(encoding="utf-8").replace("\r\n", "\n")  # git may check it out with CRLF
    assert committed == mod.render(), "run python packaging/export_rules.py"


def test_rules_carry_no_secret_values_and_no_urls_but_sources():
    data = json.loads(_exporter().render())
    # Targets are paths only; no planted value from the fake laptop is exported.
    rules_only = json.dumps({k: v for k, v in data.items() if k != "traps"})
    assert "FAKE-DEMO" not in rules_only
    for spec in data["specs"]:
        assert spec["source_ref"].startswith("https://")


def test_trap_fixtures_are_exported_verbatim():
    data = json.loads(_exporter().render())
    vs = next(t for t in data["traps"] if t["id"] == "vscode_task")
    paths = [f["path"] for f in vs["files"]]
    assert paths[0] == "README.md" and ".vscode/tasks.json" in paths
    tasks = next(f for f in vs["files"] if f["path"] == ".vscode/tasks.json")
    assert tasks["text"] == (ROOT / "traps" / "vscode_task" / ".vscode" / "tasks.json").read_text(
        encoding="utf-8").replace("\r\n", "\n")
