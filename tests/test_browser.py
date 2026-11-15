"""The report opens in the default web browser, quietly, never in the .html app.

The registry and the launch are mocked: no test starts a real browser.
"""

from __future__ import annotations

import os
import subprocess
import sys
import types
from pathlib import Path

import pytest

from spareroom import browser

EDGE = r'"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --single-argument %1'
FIREFOX = r'"C:\Program Files\Mozilla Firefox\firefox.exe" -osint -url "%1"'


def _report(tmp_path) -> Path:
    p = tmp_path / "spare room" / "spareroom-report.html"
    p.parent.mkdir()
    p.write_text("<html></html>", encoding="utf-8")
    return p


@pytest.fixture
def launches(monkeypatch):
    calls = []
    monkeypatch.setattr(browser.subprocess, "Popen", lambda cmd, **kw: calls.append((cmd, kw)))
    monkeypatch.setattr(browser.webbrowser, "open", lambda url: pytest.fail("fallback must not run"))
    return calls


def test_starts_the_default_browser_detached_and_silent(tmp_path, monkeypatch, launches):
    monkeypatch.setattr(browser, "default_browser_command", lambda: EDGE)
    report = _report(tmp_path)

    assert browser.open_report(report) == "browser"

    (cmd, kw), = launches
    uri = report.resolve().as_uri()
    # --single-argument takes the rest literally, so the URI must be bare: quotes here
    # made Edge look up a site called "file (v0.1.4 bug).
    assert cmd == r'"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --single-argument ' + uri
    assert '"' not in cmd.split("--single-argument", 1)[1]
    assert "%20" in uri  # the space in the folder name survives as the URI's own escape
    assert kw["stdin"] is subprocess.DEVNULL
    assert kw["stdout"] is subprocess.DEVNULL
    assert kw["stderr"] is subprocess.DEVNULL
    assert kw["creationflags"] & browser.DETACHED_PROCESS
    assert kw["env"]["ELECTRON_NO_ATTACH_CONSOLE"] == "1"


def test_quoted_placeholder_is_not_double_quoted(tmp_path, monkeypatch, launches):
    monkeypatch.setattr(browser, "default_browser_command", lambda: FIREFOX)
    report = _report(tmp_path)
    browser.open_report(report)
    (cmd, _), = launches
    assert cmd.endswith('-url "' + report.resolve().as_uri() + '"')
    assert '""' not in cmd


def test_template_without_placeholder_gets_the_file_appended():
    assert browser.build_command(r'"C:\b\browser.exe"', "file:///x") == r'"C:\b\browser.exe" "file:///x"'


def test_chrome_single_argument_gets_the_bare_uri():
    chrome = r'"C:\Program Files\Google\Chrome\Application\chrome.exe" --single-argument %1'
    assert browser.build_command(chrome, "file:///C:/a%20b/r.html") == (
        r'"C:\Program Files\Google\Chrome\Application\chrome.exe" --single-argument file:///C:/a%20b/r.html')


def test_target_with_a_space_is_refused():
    with pytest.raises(ValueError):
        browser.build_command("x.exe %1", "C:/a b/r.html")


def _fallback_spy(monkeypatch, seen):
    def fake_open(url):
        seen.append((url, os.environ.get("ELECTRON_NO_ATTACH_CONSOLE")))
        return True
    monkeypatch.setattr(browser.webbrowser, "open", fake_open)


def test_falls_back_with_electron_kept_off_the_console(tmp_path, monkeypatch):
    monkeypatch.setattr(browser, "default_browser_command", lambda: None)
    monkeypatch.setattr(browser.subprocess, "Popen", lambda *a, **k: pytest.fail("no browser command, no launch"))
    monkeypatch.delenv("ELECTRON_NO_ATTACH_CONSOLE", raising=False)
    seen = []
    _fallback_spy(monkeypatch, seen)
    report = _report(tmp_path)

    assert browser.open_report(report) == "fallback"
    assert seen == [(report.resolve().as_uri(), "1")]
    assert "ELECTRON_NO_ATTACH_CONSOLE" not in os.environ  # restored afterwards


def test_falls_back_when_the_launch_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(browser, "default_browser_command", lambda: EDGE)
    def boom(*a, **k):
        raise FileNotFoundError("browser moved")
    monkeypatch.setattr(browser.subprocess, "Popen", boom)
    seen = []
    _fallback_spy(monkeypatch, seen)
    assert browser.open_report(_report(tmp_path)) == "fallback"
    assert len(seen) == 1 and seen[0][1] == "1"


def _fake_winreg(monkeypatch, values):
    """A read-only fake winreg: OpenKey/QueryValueEx over `values`; any write fails the test."""
    opened = []

    class Key:
        def __init__(self, root, path):
            self.root, self.path = root, path
        def __enter__(self):
            return self
        def __exit__(self, *a):
            return False

    def open_key(root, path, *rest):
        opened.append((root, path, rest))
        if not any(k[0] == root and k[1] == path for k in values):
            raise FileNotFoundError(path)
        return Key(root, path)

    def query(key, name):
        try:
            return values[(key.root, key.path, name)], 1
        except KeyError:
            raise FileNotFoundError(name)

    fake = types.SimpleNamespace(
        HKEY_CURRENT_USER="HKCU", HKEY_CLASSES_ROOT="HKCR", OpenKey=open_key, QueryValueEx=query,
        SetValueEx=lambda *a: pytest.fail("must never write the registry"),
        CreateKey=lambda *a: pytest.fail("must never write the registry"),
        DeleteKey=lambda *a: pytest.fail("must never write the registry"),
    )
    monkeypatch.setitem(sys.modules, "winreg", fake)
    monkeypatch.setattr(browser.os, "name", "nt")
    return opened


def test_reads_userchoice_progid_and_its_command(monkeypatch):
    """The brief's lookup: HKCU ...\\http\\UserChoice ProgId, then that ProgId's shell\\open\\command."""
    opened = _fake_winreg(monkeypatch, {
        ("HKCU", browser.USER_CHOICE_KEY, "ProgId"): "MSEdgeHTM",
        ("HKCR", r"MSEdgeHTM\shell\open\command", ""): EDGE,
    })
    assert browser.default_browser_command() == EDGE
    assert ("HKCU", browser.USER_CHOICE_KEY, ()) in opened
    assert ("HKCR", r"MSEdgeHTM\shell\open\command", ()) in opened
    assert all(rest == () for _, _, rest in opened)  # default access: read only


def test_prefers_userchoicelatest_on_newer_windows_11(monkeypatch):
    _fake_winreg(monkeypatch, {
        ("HKCU", browser.USER_CHOICE_LATEST_KEY, "ProgId"): "FirefoxURL-308046B0AF4A39CB",
        ("HKCR", r"FirefoxURL-308046B0AF4A39CB\shell\open\command", ""): FIREFOX,
        ("HKCU", browser.USER_CHOICE_KEY, "ProgId"): "MSEdgeHTM",
        ("HKCR", r"MSEdgeHTM\shell\open\command", ""): EDGE,
    })
    assert browser.default_browser_command() == FIREFOX


def test_stale_progid_falls_through_to_the_http_handler(monkeypatch):
    """UserChoice names a browser that was removed (no command): use HKCR\\http instead."""
    http = r'"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "%1"'
    _fake_winreg(monkeypatch, {
        ("HKCU", browser.USER_CHOICE_KEY, "ProgId"): "SomeRemovedBrowserURL",
        ("HKCR", r"http\shell\open\command", ""): http,
    })
    assert browser.default_browser_command() == http


def test_missing_registry_entry_means_no_command(monkeypatch):
    def missing(*a, **k):
        raise FileNotFoundError
    monkeypatch.setitem(sys.modules, "winreg", types.SimpleNamespace(
        HKEY_CURRENT_USER=1, HKEY_CLASSES_ROOT=2, OpenKey=missing, QueryValueEx=missing))
    monkeypatch.setattr(browser.os, "name", "nt")
    assert browser.default_browser_command() is None
