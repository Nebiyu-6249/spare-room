"""Scanner, probe and report contain no network code, and work with no network.

Two checks: a static one (no networking modules are imported by these files) and
a runtime one (disabling sockets does not stop a scan, a probe or a report).
"""

from __future__ import annotations

import ast
import socket
from pathlib import Path

import pytest

import spareroom

PKG = Path(spareroom.__file__).resolve().parent

# The trio the criterion names, plus the modules they import from the package.
OFFLINE_MODULES = ["scanner.py", "probe.py", "report.py", "locations.py", "traps.py", "models.py",
                   "verify.py", "hardening.py", "accounts.py", "access.py", "coverage.py", "matrix.py", "doctor.py"]

FORBIDDEN = {
    "socket", "ssl", "http", "urllib", "urllib2", "urllib3", "ftplib", "smtplib",
    "telnetlib", "poplib", "imaplib", "requests", "httpx", "aiohttp", "websocket",
    "websockets", "xmlrpc", "asyncio", "webbrowser",
}


def _imported_names(path: Path):
    tree = ast.parse(path.read_text(encoding="utf-8"))
    names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for a in node.names:
                names.add(a.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                names.add(node.module.split(".")[0])
    return names


@pytest.mark.parametrize("fname", OFFLINE_MODULES)
def test_no_networking_imports(fname):
    names = _imported_names(PKG / fname)
    bad = names & FORBIDDEN
    assert not bad, f"{fname} imports networking module(s): {bad}"


def test_runs_with_sockets_disabled(monkeypatch):
    def no_network(*a, **k):
        raise AssertionError("network access attempted")

    monkeypatch.setattr(socket, "socket", no_network)
    monkeypatch.setattr(socket, "create_connection", no_network)

    from spareroom.report import render_html
    from spareroom.scanner import scan
    from spareroom.traps import TRAPS, fire_trap

    report = scan("demo")
    assert report.findings
    html = render_html(report)
    assert "<!doctype html>" in html.lower()
    result = fire_trap(TRAPS[0], account_label="test")
    assert result.visible  # the demo targets are reachable
