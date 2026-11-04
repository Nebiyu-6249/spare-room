"""Create and remove the interview account (Windows only).

`setup` and `remove-account` are the only commands that need administrator
rights. They run a short Windows PowerShell 5.1 script through UAC
(ShellExecuteEx "runas"); everything else in Spare Room runs unelevated.

The password never passes through Python: the elevated PowerShell window asks
for it with Read-Host -AsSecureString and hands the SecureString straight to
New-LocalUser. The script writes a small result JSON (no secrets) that Python
reads back.

Cmdlets and limits are from the Microsoft.PowerShell.LocalAccounts docs:
https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.localaccounts/new-localuser
Groups are addressed by well-known SID so non-English Windows works too:
https://learn.microsoft.com/en-us/windows-server/identity/ad-ds/manage/understand-security-identifiers
"""

from __future__ import annotations

import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path
from typing import Callable, Optional

from . import APP_NAME

SID_ADMINISTRATORS = "S-1-5-32-544"
SID_USERS = "S-1-5-32-545"

# New-LocalUser: names up to 20 characters, description up to 48.
MAX_NAME = 20
ACCOUNT_DESCRIPTION = f"{APP_NAME} interview account"[:48]
DEFAULT_USERNAME = "interview"

# A strict subset of what Windows allows, so a validated name can never break
# out of a quoted PowerShell string.
_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,19}$")
_RESERVED = {"administrator", "guest", "defaultaccount", "wdagutilityaccount",
             "system", "users", "administrators", "everyone"}

ERROR_CANCELLED = 1223  # the user chose No on the UAC prompt


class AccountError(Exception):
    pass


def validate_username(name: str, new: bool = False) -> str:
    """Return the name if it is safe to use, else raise AccountError. With
    new=True (creating an account) the computer's own name is refused too, so
    the sign-in name is never the confusing PCNAME\\PCNAME."""
    name = (name or "").strip()
    if not name:
        raise AccountError("Enter a user name.")
    if len(name) > MAX_NAME:
        raise AccountError(f"Windows allows at most {MAX_NAME} characters in a user name.")
    if not _NAME_RE.match(name):
        raise AccountError("Use letters, digits, '.', '_' or '-', starting with a letter or digit.")
    if name.lower() in _RESERVED:
        raise AccountError(f"'{name}' is a built-in Windows name. Pick another.")
    current = os.environ.get("USERNAME", "")
    if current and name.lower() == current.lower():
        raise AccountError("That is the account you are signed in to. Pick a new name.")
    computer = os.environ.get("COMPUTERNAME", "")
    if new and computer and name.lower() == computer.lower():
        raise AccountError(f"'{name}' is this computer's name. Pick another so the sign-in name stays clear.")
    return name


def ps_quote(value: str) -> str:
    """Single-quoted PowerShell literal; ' is escaped by doubling it."""
    return "'" + str(value).replace("'", "''") + "'"


def powershell_exe() -> str:
    """64-bit Windows PowerShell 5.1. LocalAccounts is not available in 32-bit
    PowerShell on 64-bit Windows, so a 32-bit Python must go through Sysnative."""
    root = os.environ.get("SystemRoot", r"C:\Windows")
    system_dir = "Sysnative" if os.environ.get("PROCESSOR_ARCHITEW6432") else "System32"
    return str(Path(root) / system_dir / "WindowsPowerShell" / "v1.0" / "powershell.exe")


def encode_command(script: str) -> str:
    return base64.b64encode(script.encode("utf-16-le")).decode("ascii")


# --- PowerShell scripts ------------------------------------------------------

_COMMON = r"""
$ErrorActionPreference = 'Stop'
$t0 = Get-Date
$result = [ordered]@{ ok = $false; username = $name; step = 'start'; error = $null }
function Save-Result {
  $result.elapsed_ms = [int]((Get-Date) - $t0).TotalMilliseconds
  $result | ConvertTo-Json | Set-Content -LiteralPath $resultPath -Encoding UTF8
}
"""

_SETUP_BODY = r"""
$p1 = $null; $p2 = $null
try {
  Write-Host ''
  Write-Host "$appName : creating a standard (non-admin) account named '$name'."
  Write-Host 'Choose a password you will remember. It is not shown or saved anywhere.'
  Write-Host ''
  if (Get-LocalUser -Name $name -ErrorAction SilentlyContinue) {
    throw "An account named '$name' already exists."
  }
  $result.step = 'password'
  $matched = $false
  for ($i = 0; $i -lt 3 -and -not $matched; $i++) {
    $p1 = Read-Host -AsSecureString "Password for $name"
    $p2 = Read-Host -AsSecureString 'Type it again'
    $b1 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p1)
    $b2 = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p2)
    try {
      $s1 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b1)
      $s2 = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b2)
      if ($s1.Length -eq 0) { Write-Host 'The password cannot be empty.' }
      elseif ($s1.Length -gt 127) { Write-Host 'Windows allows at most 127 characters.' }
      elseif ($s1 -cne $s2) { Write-Host 'The two entries did not match. Try again.' }
      else { $matched = $true }
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b1)
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b2)
      $s1 = $null; $s2 = $null
    }
  }
  if (-not $matched) { throw 'No matching password was entered.' }

  $result.step = 'create'
  New-LocalUser -Name $name -Password $p1 -FullName 'Interview account' `
    -Description $description -PasswordNeverExpires -AccountNeverExpires | Out-Null
  $user = Get-LocalUser -Name $name
  $result.sid = $user.SID.Value

  $result.step = 'group'
  try {
    Add-LocalGroupMember -SID $sidUsers -Member $user
  } catch {
    if ($_.FullyQualifiedErrorId -notlike 'MemberExists*') { throw }
  }

  $result.step = 'check'
  try {
    $admin = @(Get-LocalGroupMember -SID $sidAdmins | Where-Object { $_.SID.Value -eq $user.SID.Value })
    $result.is_admin = ($admin.Count -gt 0)
  } catch {
    # Get-LocalGroupMember fails on some machines with orphaned members. The
    # account was never added to Administrators; finish-setup re-checks it.
    $result.is_admin = $null
    $result.admin_check_error = $_.Exception.Message
  }
  if ($result.is_admin) { throw 'The new account is an administrator. Remove it and try again.' }

  if ($copyFrom) {
    $result.step = 'copy'
    $dest = Join-Path $env:ProgramFiles $appName
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -LiteralPath $copyFrom -Destination $dest -Force
    $result.tool_path = Join-Path $dest (Split-Path -Leaf $copyFrom)
  }

  $result.step = 'done'
  $result.ok = $true
  Write-Host ''
  Write-Host "Created '$name'. This window closes in a few seconds."
  Start-Sleep -Seconds 3
} catch {
  $result.error = $_.Exception.Message
  Write-Host ''
  Write-Host ('Setup stopped: ' + $result.error)
  Read-Host 'Press Enter to close'
} finally {
  $p1 = $null; $p2 = $null
  Save-Result
}
"""

_REMOVE_BODY = r"""
try {
  $result.step = 'lookup'
  $user = Get-LocalUser -Name $name
  $result.sid = $user.SID.Value
  if (-not $force -and $user.Description -ne $description) {
    throw "'$name' was not created by $appName. Nothing was removed."
  }
  try {
    $admin = @(Get-LocalGroupMember -SID $sidAdmins | Where-Object { $_.SID.Value -eq $user.SID.Value })
  } catch {
    if ($force) { throw "Could not confirm '$name' is not an administrator. Nothing was removed." }
    $admin = @()
  }
  if ($admin.Count -gt 0) { throw "'$name' is an administrator. Nothing was removed." }

  $userProfile = Get-CimInstance -ClassName Win32_UserProfile | Where-Object { $_.SID -eq $user.SID.Value }
  if ($userProfile) { $result.profile_path = $userProfile.LocalPath }

  $result.step = 'remove'
  Remove-LocalUser -SID $user.SID
  $result.removed = $true
  if ($result.profile_path) { $result.profile_exists = (Test-Path -LiteralPath $result.profile_path) }
  $result.step = 'done'
  $result.ok = $true
  Write-Host "Removed '$name'. This window closes in a few seconds."
  Start-Sleep -Seconds 3
} catch {
  $result.error = $_.Exception.Message
  Write-Host ('Remove stopped: ' + $result.error)
  Read-Host 'Press Enter to close'
} finally {
  Save-Result
}
"""


def _header(name: str, result_path: Path) -> str:
    return "\n".join([
        f"$name = {ps_quote(name)}",
        f"$resultPath = {ps_quote(str(result_path))}",
        f"$appName = {ps_quote(APP_NAME)}",
        f"$description = {ps_quote(ACCOUNT_DESCRIPTION)}",
        f"$sidUsers = {ps_quote(SID_USERS)}",
        f"$sidAdmins = {ps_quote(SID_ADMINISTRATORS)}",
    ])


def setup_script(name: str, result_path: Path, copy_from: Optional[str] = None) -> str:
    name = validate_username(name, new=True)
    copy_line = f"$copyFrom = {ps_quote(copy_from) if copy_from else '$null'}"
    return _header(name, result_path) + "\n" + copy_line + _COMMON + _SETUP_BODY


def remove_script(name: str, result_path: Path, force: bool = False) -> str:
    name = validate_username(name)
    return (_header(name, result_path) + f"\n$force = {'$true' if force else '$false'}"
            + _COMMON + _REMOVE_BODY)


# --- Running PowerShell ------------------------------------------------------

def run_powershell(script: str, timeout: int = 60) -> subprocess.CompletedProcess:
    """Run a short unelevated PowerShell script and capture its output."""
    return subprocess.run(
        [powershell_exe(), "-NoProfile", "-NonInteractive", "-EncodedCommand", encode_command(script)],
        capture_output=True, text=True, timeout=timeout,
    )


def run_elevated(script: str) -> int:
    """Run a PowerShell script through a UAC prompt and wait for it to finish.
    Returns its exit code, or raises AccountError if the prompt was declined."""
    if os.name != "nt":
        raise AccountError("Account setup is Windows-only.")
    import ctypes
    from ctypes import wintypes

    class SHELLEXECUTEINFOW(ctypes.Structure):
        _fields_ = [
            ("cbSize", wintypes.DWORD), ("fMask", ctypes.c_ulong), ("hwnd", wintypes.HWND),
            ("lpVerb", wintypes.LPCWSTR), ("lpFile", wintypes.LPCWSTR),
            ("lpParameters", wintypes.LPCWSTR), ("lpDirectory", wintypes.LPCWSTR),
            ("nShow", ctypes.c_int), ("hInstApp", wintypes.HINSTANCE),
            ("lpIDList", ctypes.c_void_p), ("lpClass", wintypes.LPCWSTR),
            ("hkeyClass", wintypes.HKEY), ("dwHotKey", wintypes.DWORD),
            ("hIconOrMonitor", wintypes.HANDLE), ("hProcess", wintypes.HANDLE),
        ]

    SEE_MASK_NOCLOSEPROCESS = 0x00000040
    SW_SHOWNORMAL = 1
    INFINITE = 0xFFFFFFFF

    info = SHELLEXECUTEINFOW()
    info.cbSize = ctypes.sizeof(info)
    info.fMask = SEE_MASK_NOCLOSEPROCESS
    info.lpVerb = "runas"
    info.lpFile = powershell_exe()
    info.lpParameters = f"-NoProfile -ExecutionPolicy Bypass -EncodedCommand {encode_command(script)}"
    info.nShow = SW_SHOWNORMAL

    shell32 = ctypes.WinDLL("shell32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    if not shell32.ShellExecuteExW(ctypes.byref(info)):
        err = ctypes.get_last_error()
        if err == ERROR_CANCELLED:
            raise AccountError("The Windows permission prompt was declined. Nothing was changed.")
        raise AccountError(f"Could not start an elevated PowerShell (Windows error {err}).")
    try:
        kernel32.WaitForSingleObject(info.hProcess, INFINITE)
        code = wintypes.DWORD()
        kernel32.GetExitCodeProcess(info.hProcess, ctypes.byref(code))
        return int(code.value)
    finally:
        kernel32.CloseHandle(info.hProcess)


def user_exists(name: str, runner: Callable = run_powershell) -> bool:
    script = (f"if (Get-LocalUser -Name {ps_quote(name)} -ErrorAction SilentlyContinue) "
              "{ 'yes' } else { 'no' }")
    out = runner(script)
    return out.stdout.strip().lower().endswith("yes")


def current_account_is_admin(runner: Callable = None) -> bool:
    """True if this account is in the local Administrators group, whether or not
    this process is elevated. Uses `whoami /groups`, which needs no admin."""
    if os.name != "nt" and runner is None:
        return os.geteuid() == 0 if hasattr(os, "geteuid") else False
    if runner is None:
        def runner():
            return subprocess.run(["whoami", "/groups", "/fo", "csv", "/nh"],
                                  capture_output=True, text=True, timeout=30).stdout
    return SID_ADMINISTRATORS in runner()


# --- The two admin flows -----------------------------------------------------

def result_dir() -> Path:
    """A fresh folder for the elevated step's result file.

    Not tempfile.mkdtemp: on Windows its 0o700 folder grants access to the
    folder's owner only, and a file the elevated window writes there is owned
    by Administrators, which this unelevated process cannot read. A plain
    mkdir inherits the temp folder's ACL, which names this user explicitly."""
    d = Path(tempfile.gettempdir()) / f"spareroom-{uuid.uuid4().hex[:12]}"
    d.mkdir()
    return d


def _run_with_result(script_fn, elevate: Callable, **kw) -> dict:
    tmpdir = result_dir()
    result_path = tmpdir / "result.json"
    try:
        script = script_fn(result_path=result_path, **kw)
        elevate(script)
        if not result_path.exists():
            raise AccountError("The elevated step ended without writing a result. Nothing may have changed.")
        try:
            return json.loads(result_path.read_text(encoding="utf-8-sig"))
        except PermissionError:
            raise AccountError("The elevated step finished, but its result file could not be read. "
                               "Check what happened with: Get-LocalUser")
    finally:
        try:
            result_path.unlink(missing_ok=True)
            tmpdir.rmdir()
        except OSError:
            pass


def create_account(name: str, elevate: Callable = run_elevated, copy_from: Optional[str] = None) -> dict:
    t = time.monotonic()
    result = _run_with_result(setup_script, elevate, name=name, copy_from=copy_from)
    result["wall_ms"] = int((time.monotonic() - t) * 1000)
    return result


def remove_account(name: str, elevate: Callable = run_elevated, force: bool = False) -> dict:
    return _run_with_result(remove_script, elevate, name=name, force=force)


def frozen_executable() -> Optional[str]:
    """Path of the packaged .exe when running as one, else None (source checkout)."""
    return sys.executable if getattr(sys, "frozen", False) else None
