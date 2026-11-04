"""No secret value ever appears in output, logs or report files.

A fixture plants distinctive sentinel values inside otherwise ordinary secret
files, then asserts none of those values appear in the scan JSON, the printed
summary, the probe result, or the HTML report. Only paths and labels may appear.
"""

from __future__ import annotations

import json

import pytest

from spareroom import probe
from spareroom.cli import _print_summary
from spareroom.report import render_html
from spareroom.scanner import scan

# Values that must never leak into any output.
SENTINELS = {
    "npmrc": "SENTINEL-npm-9f3a2b",
    "ssh": "SENTINEL-ssh-77c1de",
    "env": "SENTINEL-env-0b4e51",
    "aws": "SENTINEL-aws-aa11bb",
}


@pytest.fixture
def planted(tmp_path):
    home = tmp_path / "C" / "Users" / "testdev"
    (home / ".ssh").mkdir(parents=True)
    (home / ".ssh" / "id_rsa").write_text(
        f"-----BEGIN OPENSSH PRIVATE KEY-----\n{SENTINELS['ssh']}\n-----END OPENSSH PRIVATE KEY-----\n")
    (home / ".aws").mkdir(parents=True)
    (home / ".aws" / "credentials").write_text(
        f"[default]\naws_secret_access_key = {SENTINELS['aws']}\n")
    (home / ".npmrc").write_text(
        f"//registry.npmjs.org/:_authToken={SENTINELS['npmrc']}\n")
    proj = home / "projects" / "app"
    proj.mkdir(parents=True)
    (proj / ".env").write_text(f"API_KEY={SENTINELS['env']}\n")
    return tmp_path


def test_no_secret_value_in_any_output(planted, capsys):
    report = scan("demo", demo_base=planted)
    assert report.findings

    # 1. JSON output
    blob = json.dumps(report.to_dict())
    # 2. printed summary
    _print_summary(report)
    printed = capsys.readouterr().out
    # 3. HTML report
    html = render_html(report)
    # 4. probe result
    targets = [f.path for f in report.findings]
    result = json.dumps(probe.run("t", "trig", targets, "acct"))

    haystack = blob + printed + html + result
    for name, value in SENTINELS.items():
        assert value not in haystack, f"secret value for {name} leaked into output"


def test_npmrc_token_detected_without_reading_value(planted):
    report = scan("demo", demo_base=planted)
    npmrc = [f for f in report.findings if f.id == "npmrc"]
    assert npmrc and npmrc[0].kind == "npm auth token present"
    assert SENTINELS["npmrc"] not in json.dumps(npmrc[0].to_dict())
