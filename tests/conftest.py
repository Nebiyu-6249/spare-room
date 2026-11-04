import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pytest

from demo import build_fake_laptop


@pytest.fixture(scope="session", autouse=True)
def built_fake_laptop():
    """Build the bundled fake laptop once so demo scans are deterministic."""
    build_fake_laptop.main()
    return build_fake_laptop.ROOT
