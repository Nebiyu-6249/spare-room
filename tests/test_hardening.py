"""finish-setup settings changes, on temp home dirs."""

from __future__ import annotations

import json

import pytest

from spareroom import cli, hardening
from spareroom.hardening import (BACKUP_SUFFIX, apply_all, check_applied, harden_claude,
                                 harden_npm, harden_vscode, strip_jsonc)


def test_strip_jsonc_handles_comments_commas_and_strings():
    text = '''{
      // line comment
      "a": "has // not a comment",
      /* block
         comment */
      "b": "quote \\" and /* inside */",
      "c": [1, 2,],
    }'''
    data = json.loads(strip_jsonc(text))
    assert data == {"a": "has // not a comment", "b": 'quote " and /* inside */', "c": [1, 2]}


def test_vscode_fresh_home(tmp_path):
    step = harden_vscode(tmp_path)
    data = json.loads(hardening.vscode_settings_path(tmp_path).read_text())
    assert data["security.workspace.trust.enabled"] is True
    assert data["task.allowAutomaticTasks"] == "off"
    assert len(step.changes) == 2
    assert harden_vscode(tmp_path).changes == []   # idempotent


def test_vscode_keeps_other_settings_and_backs_up(tmp_path):
    p = hardening.vscode_settings_path(tmp_path)
    p.parent.mkdir(parents=True)
    p.write_text('{\n  // mine\n  "editor.fontSize": 15,\n  "task.allowAutomaticTasks": "on",\n}\n')
    harden_vscode(tmp_path)
    data = json.loads(p.read_text())
    assert data["editor.fontSize"] == 15
    assert data["task.allowAutomaticTasks"] == "off"
    assert p.with_name(p.name + BACKUP_SUFFIX).exists()


def test_vscode_unreadable_settings_left_alone(tmp_path):
    p = hardening.vscode_settings_path(tmp_path)
    p.parent.mkdir(parents=True)
    p.write_text("{ this is not json")
    step = harden_vscode(tmp_path)
    assert step.error and p.read_text() == "{ this is not json"


def test_npm_replaces_existing_line_and_keeps_others(tmp_path):
    p = hardening.npmrc_path(tmp_path)
    p.write_text("//registry.npmjs.org/:_authToken=SENTINEL-npm-value\nignore-scripts=false\n")
    step = harden_npm(tmp_path)
    lines = p.read_text().splitlines()
    assert "ignore-scripts=true" in lines and "ignore-scripts=false" not in lines
    assert any(l.startswith("//registry.npmjs.org/") for l in lines)
    assert "SENTINEL" not in json.dumps(step.to_dict())
    assert harden_npm(tmp_path).changes == []


def test_claude_merges_permissions(tmp_path):
    p = hardening.claude_settings_path(tmp_path)
    p.parent.mkdir(parents=True)
    p.write_text('{"permissions": {"allow": ["Bash(npm test)"]}}')
    harden_claude(tmp_path)
    data = json.loads(p.read_text())
    assert data["disableAllHooks"] is True
    assert data["permissions"]["disableBypassPermissionsMode"] == "disable"
    assert data["permissions"]["allow"] == ["Bash(npm test)"]


def test_check_applied_before_and_after(tmp_path):
    before = check_applied(tmp_path)
    assert "npm ignore-scripts" in before and "Claude Code hooks off" in before
    assert not any(m.startswith("VS Code") for m in before)   # VS Code defaults are already safe
    apply_all(tmp_path)
    assert check_applied(tmp_path) == []


def test_check_applied_flags_risky_vscode(tmp_path):
    p = hardening.vscode_settings_path(tmp_path)
    p.parent.mkdir(parents=True)
    p.write_text('{"security.workspace.trust.enabled": false}')
    assert "VS Code Workspace Trust" in check_applied(tmp_path)


def test_finish_setup_refuses_admin_without_force(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    args = cli.build_parser().parse_args(["finish-setup", "--no-verify"])
    assert cli.cmd_finish_setup(args, is_admin=lambda: True) == 1
    assert not hardening.npmrc_path(tmp_path).exists()
    assert "administrator" in capsys.readouterr().out


def test_finish_setup_applies_in_standard_account(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("USERPROFILE", str(tmp_path))
    args = cli.build_parser().parse_args(["finish-setup", "--no-verify"])
    assert cli.cmd_finish_setup(args, is_admin=lambda: False) == 0
    assert check_applied(tmp_path) == []
    out = capsys.readouterr().out
    assert "Gemini CLI: not changed" in out
