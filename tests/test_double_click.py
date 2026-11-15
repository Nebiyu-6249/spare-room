"""No arguments (a double-click on spareroom.exe) runs the safe demo and waits.

It must scan only the bundled fake laptop, write and open the HTML report in a
temp folder, never ask for admin, and wait for Enter before the window closes.
"""

from __future__ import annotations

from spareroom import accounts, cli


def test_double_click_runs_the_demo_and_waits(tmp_path, monkeypatch, capsys):
    prompts, opened, modes = [], [], []
    monkeypatch.setattr(cli, "_ask", lambda prompt="": prompts.append(prompt) or "")
    monkeypatch.setattr(cli.webbrowser, "open", lambda url: opened.append(url) or True)
    monkeypatch.setattr(cli, "_demo_dir", lambda: tmp_path / "demo-out")

    real_scan = cli.scan
    def scan_spy(mode="real", **kw):
        modes.append(mode)
        return real_scan(mode=mode, **kw)
    monkeypatch.setattr(cli, "scan", scan_spy)

    def no_admin(*a, **kw):
        raise AssertionError("double-click mode must never ask for admin")
    monkeypatch.setattr(accounts, "run_elevated", no_admin)

    assert cli.main([]) == 0

    assert modes == ["demo"], "only the bundled fake laptop may be scanned"
    report = tmp_path / "demo-out" / "spareroom-report.html"
    assert report.is_file()
    assert opened == [report.resolve().as_uri()]
    assert opened[0].startswith("file:")
    assert prompts == ["Press Enter to close."]

    out = capsys.readouterr().out
    assert "safe demo" in out
    assert "fake laptop" in out
    assert "does not use the internet" in out
    assert "demo (fake laptop) scan" in out


def test_double_click_keeps_the_window_open_on_failure(tmp_path, monkeypatch, capsys):
    prompts = []
    monkeypatch.setattr(cli, "_ask", lambda prompt="": prompts.append(prompt) or "")
    monkeypatch.setattr(cli, "_demo_dir", lambda: tmp_path)
    def broken(*a, **kw):
        raise RuntimeError("fake laptop missing")
    monkeypatch.setattr(cli, "scan", broken)

    assert cli.main([]) == 1
    assert "The demo could not finish: fake laptop missing" in capsys.readouterr().out
    assert prompts == ["Press Enter to close."]


def test_double_click_closes_quietly_without_a_console(tmp_path, monkeypatch):
    def eof(prompt=""):
        raise EOFError
    monkeypatch.setattr(cli, "_ask", eof)
    monkeypatch.setattr(cli.webbrowser, "open", lambda url: True)
    monkeypatch.setattr(cli, "_demo_dir", lambda: tmp_path)
    assert cli.main([]) == 0
