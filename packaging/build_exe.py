"""Build dist/spareroom.exe and dist/SHA256SUMS.txt.

  python -m pip install pyinstaller
  python packaging/build_exe.py

The exe is unsigned. The bundled demo/fake_laptop makes `scan --demo` work
from the exe alone.
"""

from __future__ import annotations

import hashlib
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def main() -> int:
    sep = ";" if sys.platform == "win32" else ":"
    cmd = [
        sys.executable, "-m", "PyInstaller", "--noconfirm", "--clean", "--onefile",
        "--console", "--name", "spareroom",
        "--add-data", f"{ROOT / 'demo' / 'fake_laptop'}{sep}demo/fake_laptop",
        "--distpath", str(DIST), "--workpath", str(ROOT / "build"), "--specpath", str(ROOT / "build"),
        str(ROOT / "packaging" / "entry.py"),
    ]
    subprocess.run(cmd, check=True, cwd=ROOT)
    exe = DIST / "spareroom.exe"
    digest = hashlib.sha256(exe.read_bytes()).hexdigest()
    (DIST / "SHA256SUMS.txt").write_text(f"{digest}  spareroom.exe\n", encoding="utf-8")
    print(f"{exe}\nSHA-256 {digest}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
