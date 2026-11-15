"""Open a local HTML report in the default web browser, quietly.

Why not just webbrowser.open(file): on Windows that hands the file to whatever
app owns .html files, which on many developer PCs is VS Code, and Electron apps
attach to the parent console and print their startup log into ours.

So, on Windows: read the default *browser* (the app for http links) from the
registry, read-only, and start it detached with stdin, stdout and stderr on
DEVNULL. If that lookup or launch fails, fall back to webbrowser.open with
ELECTRON_NO_ATTACH_CONSOLE=1 set, so an Electron app that ends up opening the
file still keeps out of our window. Local files only; no network.
"""

from __future__ import annotations

import os
import subprocess
import webbrowser
from pathlib import Path
from typing import Optional

ASSOC = r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http"
USER_CHOICE_KEY = ASSOC + r"\UserChoice"
# Newer Windows 11 builds keep the effective choice here; the older UserChoice
# can still hold a stale ProgId from a browser that was removed.
USER_CHOICE_LATEST_KEY = ASSOC + r"\UserChoiceLatest\ProgId"

# Windows process-creation flags (spelled out so this module imports anywhere).
DETACHED_PROCESS = 0x00000008
CREATE_NEW_PROCESS_GROUP = 0x00000200

QUIET_ENV = {"ELECTRON_NO_ATTACH_CONSOLE": "1"}


def default_browser_command() -> Optional[str]:
    """The default browser's open command, e.g. '"C:\\...\\msedge.exe" --single-argument %1'.

    Tries, in order, and takes the first ProgId that has a shell\\open\\command:
      1. HKCU\\...\\UrlAssociations\\http\\UserChoiceLatest\\ProgId (newer Windows 11),
      2. HKCU\\...\\UrlAssociations\\http\\UserChoice, value ProgId,
      3. the http protocol's own handler, HKEY_CLASSES_ROOT\\http.
    HKEY_CLASSES_ROOT merges the user's and the machine's classes. Only reads;
    never writes. None if nothing usable is found.
    """
    if os.name != "nt":
        return None
    try:
        import winreg
    except ImportError:
        return None

    def read(root, path, name):
        try:
            with winreg.OpenKey(root, path) as key:
                value, _ = winreg.QueryValueEx(key, name)
            return value or None
        except OSError:
            return None

    candidates = [read(winreg.HKEY_CURRENT_USER, USER_CHOICE_LATEST_KEY, "ProgId"),
                  read(winreg.HKEY_CURRENT_USER, USER_CHOICE_KEY, "ProgId"),
                  "http"]
    for prog_id in candidates:
        if prog_id:
            command = read(winreg.HKEY_CLASSES_ROOT, prog_id + r"\shell\open\command", "")
            if command:
                return command
    return None


def build_command(template: str, target: str) -> str:
    """Fill the registry command template with the file's URI.

    Templates use %1 (sometimes %L), quoted or not; %* is dropped. Environment
    variables are expanded first, so a URI's own %20 escapes are never touched.
    """
    cmd = os.path.expandvars(template).replace("%*", "").strip()
    quoted = f'"{target}"'
    for token in ('"%1"', '"%L"', '"%l"'):
        if token in cmd:
            return cmd.replace(token, quoted, 1)
    for token in ("%1", "%L", "%l"):
        if token in cmd:
            return cmd.replace(token, quoted, 1)
    return f"{cmd} {quoted}"


def _quiet_env() -> dict:
    env = dict(os.environ)
    env.update(QUIET_ENV)
    return env


def open_report(path: Path) -> str:
    """Open the report. Returns 'browser' (default browser started), 'fallback'
    (webbrowser.open), or 'failed' (nothing could open it)."""
    uri = Path(path).resolve().as_uri()
    template = default_browser_command()
    if template:
        try:
            subprocess.Popen(
                build_command(template, uri),
                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                close_fds=True, creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
                env=_quiet_env(),
            )
            return "browser"
        except OSError:
            pass
    # Fallback: the old way, but keep Electron apps (VS Code and friends) off our console.
    saved = {k: os.environ.get(k) for k in QUIET_ENV}
    os.environ.update(QUIET_ENV)
    try:
        return "fallback" if webbrowser.open(uri) else "failed"
    except Exception:
        return "failed"
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
