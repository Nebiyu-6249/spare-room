"""setup / remove-account logic, with the elevated step faked.

Nothing here creates or removes a real account. The generated PowerShell is
checked by PowerShell's own parser (parse only, nothing is executed).
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import types

import pytest

from spareroom import accounts, cli
from spareroom.accounts import AccountError

_RESULT_RE = re.compile(r"^\$resultPath = '((?:[^']|'')*)'$", re.M)


def _result_path(script: str) -> str:
    return _RESULT_RE.search(script).group(1).replace("''", "'")


def fake_elevate(result: dict):
    """An 'elevated run' that just writes the given result where the script would."""
    calls = []

    def run(script):
        calls.append(script)
        with open(_result_path(script), "w", encoding="utf-8") as fh:
            json.dump(result, fh)
        return 0

    run.calls = calls
    return run


# --- validation and quoting --------------------------------------------------

@pytest.mark.parametrize("name", ["interview", "dev.test_1", "a", "X" * 20])
def test_valid_names(name, monkeypatch):
    monkeypatch.setenv("USERNAME", "someone-else")
    assert accounts.validate_username(name) == name


@pytest.mark.parametrize("name", ["", "   ", "X" * 21, "bad'name", 'q"uote', "a b", "a@b",
                                  "semi;colon", "..", ".hidden", "Administrator", "GUEST", "x$(calc)"])
def test_invalid_names(name, monkeypatch):
    monkeypatch.setenv("USERNAME", "someone-else")
    with pytest.raises(AccountError):
        accounts.validate_username(name)


def test_refuses_current_account(monkeypatch):
    monkeypatch.setenv("USERNAME", "Alex")
    with pytest.raises(AccountError):
        accounts.validate_username("alex")


def test_ps_quote_doubles_single_quotes():
    assert accounts.ps_quote("O'Brien") == "'O''Brien'"


def test_encode_command_is_utf16_base64():
    import base64
    assert base64.b64decode(accounts.encode_command("Write-Host hi")).decode("utf-16-le") == "Write-Host hi"


def test_powershell_exe_uses_sysnative_for_32bit_python(monkeypatch):
    monkeypatch.setenv("SystemRoot", r"C:\Windows")
    monkeypatch.setenv("PROCESSOR_ARCHITEW6432", "AMD64")
    assert "Sysnative" in accounts.powershell_exe()
    monkeypatch.delenv("PROCESSOR_ARCHITEW6432")
    assert "System32" in accounts.powershell_exe()


# --- generated scripts -------------------------------------------------------

def test_setup_script_shape(tmp_path):
    rp = tmp_path / "it's" / "result.json"
    s = accounts.setup_script("interview", result_path=rp)
    assert "$name = 'interview'" in s
    assert _result_path(s) == str(rp)                 # apostrophe survives quoting
    assert "Read-Host -AsSecureString" in s           # password asked in the elevated window
    assert accounts.SID_USERS in s and accounts.SID_ADMINISTRATORS in s
    assert "New-LocalUser" in s and "-Description $description" in s
    assert "$copyFrom = $null" in s
    assert "Add-LocalGroupMember -SID $sidUsers" in s
    assert "ConvertFrom-SecureString" not in s        # password is never serialised


def test_description_fits_windows_limit():
    assert len(accounts.ACCOUNT_DESCRIPTION) <= 48


def test_remove_script_checks_marker_and_admin(tmp_path):
    s = accounts.remove_script("interview", result_path=tmp_path / "r.json")
    assert "$force = $false" in s
    assert "$user.Description -ne $description" in s
    assert "is an administrator. Nothing was removed." in s
    assert "Remove-LocalUser -SID $user.SID" in s
    assert "Win32_UserProfile" in s
    assert "$profile " not in s                       # do not clobber PowerShell's $PROFILE


def test_scripts_reject_unvalidated_names(tmp_path):
    with pytest.raises(AccountError):
        accounts.setup_script("x'; Remove-Item C:\\ -Recurse; '", result_path=tmp_path / "r")


@pytest.mark.skipif(os.name != "nt", reason="needs Windows PowerShell")
def test_scripts_parse_cleanly_in_powershell(tmp_path):
    parse = r"""
$errs = $null
[void][System.Management.Automation.Language.Parser]::ParseInput($input_script, [ref]$null, [ref]$errs)
if ($errs) { $errs | ForEach-Object { $_.Message } } else { 'OK' }
"""
    for script in (accounts.setup_script("interview", result_path=tmp_path / "a.json", copy_from=r"C:\x\spareroom.exe"),
                   accounts.remove_script("interview", result_path=tmp_path / "b.json", force=True)):
        wrapper = f"$input_script = @'\n{script}\n'@\n" + parse
        out = accounts.run_powershell(wrapper)
        assert out.stdout.strip() == "OK", out.stdout + out.stderr


# --- unelevated helpers ------------------------------------------------------

def test_user_exists_reads_runner_output():
    yes = lambda s: types.SimpleNamespace(stdout="yes\r\n")
    no = lambda s: types.SimpleNamespace(stdout="no\r\n")
    assert accounts.user_exists("interview", runner=yes) is True
    assert accounts.user_exists("interview", runner=no) is False


@pytest.mark.skipif(os.name != "nt", reason="needs Windows PowerShell")
def test_user_exists_live_for_missing_name():
    assert accounts.user_exists("sr-no-such-user-9") is False


def test_admin_detection_from_whoami():
    admin = '"BUILTIN\\Administrators","Alias","S-1-5-32-544","Group used for deny only"'
    std = '"BUILTIN\\Users","Alias","S-1-5-32-545","Mandatory group, Enabled by default"'
    assert accounts.current_account_is_admin(runner=lambda: admin + "\n" + std) is True
    assert accounts.current_account_is_admin(runner=lambda: std) is False


# --- flows with a faked elevated step ----------------------------------------

def test_create_account_reads_result_and_cleans_up():
    elevate = fake_elevate({"ok": True, "username": "interview", "is_admin": False, "elapsed_ms": 900})
    r = accounts.create_account("interview", elevate=elevate)
    assert r["ok"] and r["wall_ms"] >= 0
    assert not os.path.exists(_result_path(elevate.calls[0]))


def test_create_account_without_result_raises():
    with pytest.raises(AccountError):
        accounts.create_account("interview", elevate=lambda script: 0)


def _answers(monkeypatch, *replies):
    it = iter(replies)
    monkeypatch.setattr(cli, "_ask", lambda prompt: next(it))


@pytest.mark.skipif(os.name != "nt", reason="setup is Windows-only")
def test_cmd_setup_happy_path(monkeypatch, capsys):
    monkeypatch.setenv("USERNAME", "owner")
    _answers(monkeypatch, "", "y")  # default name, confirm
    elevate = fake_elevate({"ok": True, "username": "interview", "is_admin": False})
    args = cli.build_parser().parse_args(["setup"])
    assert cli.cmd_setup(args, elevate=elevate, exists=lambda n: False) == 0
    out = capsys.readouterr().out
    assert "Created 'interview'" in out and "finish-setup" in out
    assert "weaker than a virtual machine" in out


@pytest.mark.skipif(os.name != "nt", reason="setup is Windows-only")
def test_cmd_setup_declined_changes_nothing(monkeypatch, capsys):
    monkeypatch.setenv("USERNAME", "owner")
    _answers(monkeypatch, "interview", "n")
    elevate = fake_elevate({"ok": True})
    args = cli.build_parser().parse_args(["setup"])
    assert cli.cmd_setup(args, elevate=elevate, exists=lambda n: False) == 1
    assert elevate.calls == []
    assert "Nothing was changed" in capsys.readouterr().out


@pytest.mark.skipif(os.name != "nt", reason="setup is Windows-only")
def test_cmd_setup_existing_name_is_refused(monkeypatch):
    monkeypatch.setenv("USERNAME", "owner")
    elevate = fake_elevate({"ok": True})
    args = cli.build_parser().parse_args(["setup", "--username", "interview", "--yes"])
    assert cli.cmd_setup(args, elevate=elevate, exists=lambda n: True) == 1
    assert elevate.calls == []


@pytest.mark.skipif(os.name != "nt", reason="setup is Windows-only")
def test_cmd_setup_uac_declined(monkeypatch, capsys):
    monkeypatch.setenv("USERNAME", "owner")

    def declined(script):
        raise AccountError("The Windows permission prompt was declined. Nothing was changed.")

    args = cli.build_parser().parse_args(["setup", "--username", "interview", "--yes"])
    assert cli.cmd_setup(args, elevate=declined, exists=lambda n: False) == 1
    assert "declined" in capsys.readouterr().out


@pytest.mark.skipif(os.name != "nt", reason="remove-account is Windows-only")
def test_cmd_remove_requires_typed_name(monkeypatch):
    monkeypatch.setenv("USERNAME", "owner")
    _answers(monkeypatch, "wrong")
    elevate = fake_elevate({"ok": True})
    args = cli.build_parser().parse_args(["remove-account"])
    assert cli.cmd_remove_account(args, elevate=elevate) == 1
    assert elevate.calls == []


@pytest.mark.skipif(os.name != "nt", reason="remove-account is Windows-only")
def test_cmd_remove_explains_profile_cleanup(monkeypatch, capsys):
    monkeypatch.setenv("USERNAME", "owner")
    _answers(monkeypatch, "interview")
    elevate = fake_elevate({"ok": True, "removed": True,
                            "profile_path": r"C:\Users\interview", "profile_exists": True})
    args = cli.build_parser().parse_args(["remove-account"])
    assert cli.cmd_remove_account(args, elevate=elevate) == 0
    out = capsys.readouterr().out
    assert r"C:\Users\interview" in out and "permanently deletes" in out


@pytest.mark.skipif(os.name != "nt", reason="remove-account is Windows-only")
def test_cmd_remove_reports_refusal(monkeypatch, capsys):
    monkeypatch.setenv("USERNAME", "owner")
    elevate = fake_elevate({"ok": False, "step": "lookup",
                            "error": "'bob' was not created by Spare Room. Nothing was removed."})
    args = cli.build_parser().parse_args(["remove-account", "--username", "bob", "--yes"])
    assert cli.cmd_remove_account(args, elevate=elevate) == 1
    assert "not created by" in capsys.readouterr().out
