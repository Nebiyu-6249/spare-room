"""Matrix from recorded probe results; probe --fake-laptop; verify --only-profile."""

from __future__ import annotations

import json
import shutil

from spareroom import matrix, probe
from spareroom.traps import DEMO_TARGETS, bundled_fake_laptop, demo_targets
from spareroom.verify import cross_profile_findings


def _copy(tmp_path):
    dest = tmp_path / "SpareRoomTest" / "fake_laptop"
    shutil.copytree(bundled_fake_laptop(), dest)
    return dest


def test_probe_fake_laptop_option(tmp_path, capsys):
    fl = _copy(tmp_path)
    out = tmp_path / "normal.json"
    assert probe.main(["--fake-laptop", str(fl), "--trap-id", "twin_probe", "--trigger", "manual",
                       "--account", "normal", "--out", str(out)]) == 0
    r = json.loads(out.read_text())
    assert len(r["visible"]) == len(DEMO_TARGETS) and r["blocked"] == []


def test_matrix_and_isolation_check(tmp_path):
    fl = _copy(tmp_path)
    paths = [str(p) for p in demo_targets(fl)]
    normal = probe.run("twin_probe", "manual", paths, "normal")
    interview = {"trap_id": "twin_probe", "trigger": "manual", "account_label": "interview",
                 "visible": [], "blocked": paths[:-1], "ran_at": "x"}
    m = matrix.build(fl, [normal, interview])
    assert m["columns"][0]["cells"] == ["visible"] * len(DEMO_TARGETS)
    assert m["columns"][1]["cells"][-1] == "absent"
    assert matrix.isolation_problems(m, "normal", "interview") == []

    leaky = dict(interview, visible=[paths[0]])
    assert matrix.isolation_problems(matrix.build(fl, [normal, leaky]), "normal", "interview")

    md = matrix.render_markdown(m)
    assert ".ssh/id_rsa" in md and str(tmp_path) not in md


def test_redaction_hides_absolute_paths(tmp_path):
    fl = _copy(tmp_path)
    r = probe.run("twin_probe", "manual", [str(p) for p in demo_targets(fl)] + [r"C:\Users\x\.npmrc"], "normal")
    red = matrix.redact_result(r, fl)
    blob = json.dumps(red)
    assert str(tmp_path).replace("\\", "\\\\") not in blob
    assert all(p.startswith("<fake_laptop>") for p in red["visible"])


def test_verify_only_profile_leaves_others_alone(tmp_path):
    users = tmp_path / "Users"
    own, me, other = users / "interview", users / "me", users / "someone"
    own.mkdir(parents=True)
    for p in (me, other):
        (p / ".ssh").mkdir(parents=True)
        (p / ".ssh" / "id_rsa").write_text("placeholder")
    findings, checked, _ = cross_profile_findings(users, own, only_profiles=["me"])
    assert findings and all("someone" not in f.path for f in findings)
