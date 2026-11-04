"""Readability from permissions, not from os.access alone."""

from __future__ import annotations

import os
import subprocess

import pytest

from spareroom.access import ABSENT, BLOCKED, VISIBLE, can_read, path_state


def test_states_for_plain_files(tmp_path):
    f = tmp_path / "a.txt"
    f.write_text("x")
    assert path_state(f) == VISIBLE
    assert path_state(tmp_path) == VISIBLE
    assert path_state(tmp_path / "missing.txt") == ABSENT


def test_permission_error_on_stat_is_blocked(tmp_path, monkeypatch):
    def stat(p, *a, **k):
        raise PermissionError(13, "Access is denied")

    monkeypatch.setattr(os, "stat", stat)
    assert path_state(tmp_path / "x") == BLOCKED


@pytest.mark.skipif(os.name != "nt", reason="Windows ACLs")
def test_deny_ace_is_blocked_even_though_os_access_says_yes(tmp_path):
    f = tmp_path / "denied.txt"
    f.write_text("x")
    me = subprocess.run(["whoami"], capture_output=True, text=True).stdout.strip()
    # Deny only "read data": the DACL stays readable, so AccessCheck itself
    # must decide, and icacls can still remove the deny afterwards.
    subprocess.run(["icacls", str(f), "/deny", f"{me}:(RD)"], capture_output=True, check=True)
    try:
        assert os.access(f, os.R_OK)          # the old check would have called this readable
        assert can_read(f) is False
        assert path_state(f) == BLOCKED
    finally:
        subprocess.run(["icacls", str(f), "/remove:d", me], capture_output=True)
    assert path_state(f) == VISIBLE
