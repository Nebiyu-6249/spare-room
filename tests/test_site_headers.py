"""The site's security headers are set twice, once per host: Netlify reads
web/public/_headers, Vercel reads web/public/vercel.json. They must agree."""

from __future__ import annotations

import json
from pathlib import Path

PUBLIC = Path(__file__).resolve().parent.parent / "web" / "public"


def _netlify() -> dict:
    lines = (PUBLIC / "_headers").read_text(encoding="utf-8").splitlines()
    assert lines[0].strip() == "/*"
    return dict(l.strip().split(": ", 1) for l in lines[1:] if l.strip())


def _vercel() -> dict:
    cfg = json.loads((PUBLIC / "vercel.json").read_text(encoding="utf-8"))
    (rule,) = cfg["headers"]
    assert rule["source"] == "/(.*)"
    return {h["key"]: h["value"] for h in rule["headers"]}


def test_both_hosts_send_the_same_headers():
    assert _vercel() == _netlify()


def test_csp_allows_nothing_from_other_hosts():
    csp = _vercel()["Content-Security-Policy"]
    assert "default-src 'self'" in csp and "connect-src 'self'" in csp
    assert "http" not in csp
