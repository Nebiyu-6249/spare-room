"""PyInstaller entry point for the single-file spareroom.exe."""

import sys

from spareroom.cli import main

if __name__ == "__main__":
    sys.exit(main())
