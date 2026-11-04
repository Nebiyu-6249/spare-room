"""doctor: tool lookup, install scope, the Store shortcut, and the report shape."""

from __future__ import annotations

import json

from spareroom import cli, doctor

ENV = {"ProgramFiles": r"C:\Program Files", "ProgramFiles(x86)": r"C:\Program Files (x86)",
       "ProgramData": r"C:\ProgramData", "SystemRoot": r"C:\Windows", "USERPROFILE": r"C:\Users\interview"}

PATHS = {
    "node": r"C:\Program Files\nodejs\node.exe",
    "npm": r"C:\Program Files\nodejs\npm.cmd",
    "python": r"C:\Users\interview\AppData\Local\Microsoft\WindowsApps\python.exe",
    "git": None,
    "code": r"C:\Users\interview\AppData\Local\Programs\Microsoft VS Code\bin\code.cmd",
}


def run_check():
    return {r.name: r for r in doctor.check(which=PATHS.get, version=lambda p: "v1.0", env=ENV)}


def test_scope_classification():
    assert doctor.scope_of(r"C:\Program Files\Git\cmd\git.exe", ENV) == doctor.ALL_USERS
    assert doctor.scope_of(r"C:\Users\interview\AppData\Local\Programs\x.exe", ENV) == doctor.THIS_ACCOUNT
    assert doctor.scope_of(r"D:\tools\git.exe", ENV) == doctor.OTHER


def test_found_missing_and_store_alias():
    r = run_check()
    assert r["node"].found and r["node"].scope == doctor.ALL_USERS and r["node"].version == "v1.0"
    assert r["code"].found and r["code"].scope == doctor.THIS_ACCOUNT
    assert not r["git"].found and "--scope machine" in r["git"].install
    py = r["python"]
    assert not py.found and "Microsoft Store" in py.note and "Python.Python.3.12" in py.install


def test_every_tool_has_all_users_install_advice():
    names = [t[0] for t in doctor.TOOLS]
    assert names == ["node", "npm", "python", "git", "code"]
    for name, _, install in doctor.TOOLS:
        assert "--scope machine" in install, name


def test_missing_tools_never_run_anything():
    called = []
    doctor.check(which=lambda n: None, version=lambda p: called.append(p), env=ENV)
    assert called == []


def test_report_json_shape():
    rep = doctor.report(list(run_check().values()), account_label="interview")
    blob = json.loads(json.dumps(rep))
    assert blob["account_label"] == "interview"
    assert {"name", "label", "found", "path", "scope", "version", "note", "install"} <= set(blob["tools"][0])


def test_cli_doctor_writes_json(tmp_path, monkeypatch, capsys):
    results = list(run_check().values())
    monkeypatch.setattr(doctor, "check", lambda: results)
    out = tmp_path / "doctor.json"
    assert cli.main(["doctor", "--json", str(out)]) == 0
    printed = capsys.readouterr().out
    assert "3 of 5 coding tools are available" in printed and "administrator rights" in printed
    assert len(json.loads(out.read_text())["tools"]) == 5
