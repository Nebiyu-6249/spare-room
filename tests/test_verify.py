"""verify: cross-profile reach, settings check, and the probe's blocked logic."""

from __future__ import annotations

import os

from spareroom import probe
from spareroom.hardening import apply_all
from spareroom.verify import (cross_profile_findings, home_relative_targets, other_profiles,
                              verify)


def _users(tmp_path):
    users = tmp_path / "C" / "Users"
    own = users / "interview"
    main = users / "main"
    (users / "Public").mkdir(parents=True)
    own.mkdir(parents=True)
    (main / ".ssh").mkdir(parents=True)
    (main / ".ssh" / "id_rsa").write_text("placeholder")
    (main / ".npmrc").write_text("placeholder")
    return users, own, main


def test_targets_are_relative_and_cover_browsers():
    targets = home_relative_targets()
    assert all(not os.path.isabs(os.path.join(*rel)) for _, rel in targets)
    flat = ["/".join(rel) for _, rel in targets]
    assert any(f.endswith("Default/Login Data") for f in flat)
    assert any("Local Extension Settings/nkbihfbeogaeaoehlefnkodbefgpgknn" in f for f in flat)


def test_other_profiles_skips_self_and_public(tmp_path):
    users, own, main = _users(tmp_path)
    assert other_profiles(users, own) == [main]


def test_readable_files_in_another_profile_are_findings(tmp_path):
    # Temp dirs have no per-user ACLs, which simulates a profile whose
    # permissions were loosened: the files are visible from "interview".
    users, own, main = _users(tmp_path)
    findings, checked, blocked = cross_profile_findings(users, own)
    paths = {f.path for f in findings}
    assert str(main / ".ssh" / "id_rsa") in paths and str(main / ".npmrc") in paths
    assert all(f.severity == "high" for f in findings)
    assert {f.category for f in findings} == {"ssh", "token"}
    assert checked == len(home_relative_targets()) and blocked == 0


def test_blocked_profile_is_counted_not_reported(tmp_path, monkeypatch):
    users, own, main = _users(tmp_path)
    real_stat = os.stat

    def stat(p, *a, **k):
        if str(p).startswith(str(main)):
            raise PermissionError(13, "Access is denied")
        return real_stat(p, *a, **k)

    monkeypatch.setattr(probe.os, "stat", stat)
    findings, _, blocked = cross_profile_findings(users, own)
    assert findings == []
    assert blocked == len(home_relative_targets())


def test_verify_end_to_end_on_temp_machine(tmp_path):
    users, own, main = _users(tmp_path)
    apply_all(own)
    d = tmp_path / "D"
    (d / "shared").mkdir(parents=True)
    (d / "shared" / ".env").write_text("placeholder")

    report, blocked = verify(home=own, drives=[d], users_root=users, account_label="interview")
    kinds = {f.kind for f in report.findings}
    assert "another account's secret file is readable" in kinds
    assert any(f.category == "env_file" and f.path.endswith(".env") for f in report.findings)
    assert not any(f.kind.startswith("not applied") for f in report.findings)
    assert report.account_label == "interview"


def test_verify_flags_missing_hardening(tmp_path):
    users, own, _ = _users(tmp_path)
    report, _ = verify(home=own, drives=[], users_root=users)
    missing = {f.kind for f in report.findings if f.kind.startswith("not applied")}
    assert "not applied: npm ignore-scripts" in missing


def test_probe_permission_error_is_blocked(tmp_path, monkeypatch):
    target = tmp_path / "locked.txt"

    def stat(p, *a, **k):
        raise PermissionError(13, "Access is denied")

    monkeypatch.setattr(probe.os, "stat", stat)
    visible, blocked = probe.check_paths([str(target)])
    assert visible == [] and blocked == [str(target)]
