"""The coverage table points at real checks and real sources, and EVALUATION.md is current."""

from __future__ import annotations

from pathlib import Path

from spareroom import coverage
from spareroom import locations as L

ROOT = Path(__file__).resolve().parent.parent


def test_every_check_id_exists():
    valid = coverage.valid_check_ids()
    for _, target, check, _ in coverage.ROWS:
        assert check is None or check in valid, f"{target}: unknown check {check}"


def test_uncovered_rows_say_why():
    for _, target, check, note in coverage.ROWS:
        if check is None:
            assert note, f"{target} is not covered but has no reason"


def test_sources_are_the_cited_constants():
    cited = {v for k, v in vars(L).items() if k.startswith("SRC_")}
    for (name, url), *_ in coverage.ROWS:
        assert url.startswith("https://") and url in cited, name


def test_items_match_data_model():
    for item in coverage.items():
        d = item.to_dict()
        assert set(d) == {"attacker_source", "target", "check_id"}
        assert set(d["attacker_source"]) == {"name", "url"}


def test_evaluation_md_table_is_current():
    text = (ROOT / "EVALUATION.md").read_text(encoding="utf-8")
    a = text.index(coverage.START) + len(coverage.START)
    b = text.index(coverage.END)
    assert text[a:b].strip() == coverage.render_markdown().strip(), \
        "run: python -m spareroom.coverage --update EVALUATION.md"
