"""Local HTML report. Calm and factual, like a medical test report: one big
number, short sentences, monospace paths. It loads nothing external (no fonts,
CSS, scripts or images from the network) and contains no secret values.
"""

from __future__ import annotations

import html
from pathlib import Path

from . import APP_NAME
from .models import ScanReport

CATEGORY_LABELS = {
    "ssh": "SSH keys",
    "cloud": "Cloud credentials",
    "token": "Developer tokens",
    "env_file": "Environment files (.env)",
    "wallet_extension": "Crypto wallet extensions",
    "desktop_wallet": "Desktop crypto wallets",
    "browser_store": "Browser password stores",
    "ai_tool": "AI tool sign-ins",
    "shell_history": "Shell history",
    "editor_setting": "Editor settings",
}

SEVERITY_ORDER = {"high": 0, "medium": 1, "info": 2}

# System fonts only; severity shown as a colour swatch plus the word (no emoji).
_STYLE = """
:root {
  --bg: #fafaf7; --ink: #1a1a1a; --muted: #5f6b7a; --line: #e2e2dc;
  --accent: #1f5c8a; --high: #b00020; --medium: #9a5b00; --info: #5f6b7a;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.5; padding: 0 16px;
}
main { max-width: 820px; margin: 0 auto; padding: 40px 0 80px; }
.path, code { font-family: "Cascadia Code", Consolas, "SF Mono", Menlo, monospace; }
h1 { font-size: 20px; font-weight: 600; margin: 0 0 4px; }
.sub { color: var(--muted); margin: 0 0 32px; font-size: 14px; }
.headline { border-top: 3px solid var(--accent); padding-top: 20px; margin-bottom: 32px; }
.bignum { font-size: 56px; font-weight: 700; line-height: 1; }
.bigtext { font-size: 18px; margin-top: 8px; }
.tally { color: var(--muted); font-size: 14px; margin-top: 12px; }
.tally b { color: var(--ink); font-weight: 600; }
.cat { margin: 28px 0 8px; font-size: 15px; font-weight: 600;
       border-bottom: 1px solid var(--line); padding-bottom: 6px; }
.item { padding: 14px 0; border-bottom: 1px solid var(--line); }
.item:last-child { border-bottom: none; }
.sev { display: inline-flex; align-items: center; font-size: 12px;
       text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
.swatch { width: 10px; height: 10px; border-radius: 2px; display: inline-block; margin-right: 6px; }
.sev-high .swatch { background: var(--high); } .sev-high { color: var(--high); }
.sev-medium .swatch { background: var(--medium); } .sev-medium { color: var(--medium); }
.sev-info .swatch { background: var(--info); } .sev-info { color: var(--info); }
.kind { font-weight: 600; margin-left: 10px; }
.p { display: block; margin: 6px 0; word-break: break-all; font-size: 13px; color: #333; }
.why { margin: 4px 0; font-size: 14px; }
.fix { margin: 4px 0; font-size: 14px; color: var(--muted); }
.fix b { color: var(--ink); }
.src { font-size: 12px; } .src a { color: var(--accent); }
footer { color: var(--muted); font-size: 12px; margin-top: 40px;
         border-top: 1px solid var(--line); padding-top: 16px; }
.none { font-size: 18px; }
"""


def _sev_span(sev: str) -> str:
    cls = f"sev sev-{html.escape(sev)}"
    return f'<span class="{cls}"><span class="swatch"></span>{html.escape(sev)}</span>'


def render_html(report: ScanReport) -> str:
    findings = list(report.findings)
    counts = {"high": 0, "medium": 0, "info": 0}
    for f in findings:
        counts[f.severity] = counts.get(f.severity, 0) + 1

    total = len(findings)
    if total == 0:
        headline = (
            '<div class="headline"><div class="none">Nothing found in the '
            f'{report.locations_checked} places checked.</div></div>'
        )
    else:
        headline = (
            '<div class="headline">'
            f'<div class="bignum">{total}</div>'
            f'<div class="bigtext">{"thing" if total == 1 else "things"} stranger code running as you could reach</div>'
            f'<div class="tally"><b>{counts["high"]}</b> high &nbsp; '
            f'<b>{counts["medium"]}</b> medium &nbsp; <b>{counts["info"]}</b> info</div>'
            "</div>"
        )

    # Group by category, high severity first within each.
    by_cat: dict = {}
    for f in findings:
        by_cat.setdefault(f.category, []).append(f)

    sections = []
    for cat in CATEGORY_LABELS:
        items = by_cat.get(cat)
        if not items:
            continue
        items.sort(key=lambda x: SEVERITY_ORDER.get(x.severity, 9))
        rows = []
        for f in items:
            src = ""
            if f.source_ref:
                src = (f'<div class="src">Source: '
                       f'<a href="{html.escape(f.source_ref)}">{html.escape(f.source_ref)}</a></div>')
            rows.append(
                '<div class="item">'
                f'{_sev_span(f.severity)}<span class="kind">{html.escape(f.kind)}</span>'
                f'<code class="p">{html.escape(f.path)}</code>'
                f'<div class="why">{html.escape(f.reason)}</div>'
                f'<div class="fix"><b>Fix:</b> {html.escape(f.fix)}</div>'
                f'{src}'
                "</div>"
            )
        sections.append(
            f'<section><div class="cat">{html.escape(CATEGORY_LABELS[cat])} '
            f'({len(items)})</div>{"".join(rows)}</section>'
        )

    mode_note = "demo (bundled fake laptop)" if report.mode == "demo" else "real scan"
    doc = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(APP_NAME)} report</title>
<style>{_STYLE}</style>
</head>
<body>
<main>
<h1>{html.escape(APP_NAME)}</h1>
<p class="sub">What code you are about to run could reach from this account.
Account: {html.escape(report.account_label or "(unnamed)")} &middot; {mode_note} &middot;
checked {report.locations_checked} locations in {report.duration_ms} ms &middot; {html.escape(report.started_at)}</p>
{headline}
{"".join(sections)}
<footer>
A separate standard account is weaker than a virtual machine. Malware running with
administrator rights, files that every user can read, and a shared network or VPN
can still be reached. No secret values are read, stored or shown by this tool.
{html.escape(APP_NAME)} {html.escape(report.tool_version)}.
</footer>
</main>
</body>
</html>
"""
    return doc


def write_report(report: ScanReport, out_path: Path) -> Path:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(render_html(report), encoding="utf-8")
    return out_path
