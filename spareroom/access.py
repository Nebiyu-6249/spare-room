"""Can this account read a path? Answered from permissions, never from contents.

On Windows, os.access only looks at the read-only attribute, and os.stat can
succeed when the parent folder can be listed even if the file itself is denied.
So on Windows we read the file's security descriptor (GetFileSecurityW) and ask
Windows whether this process's own token is granted read access (AccessCheck),
the documented way to evaluate a DACL for the current user. The file's data is
never read. Elsewhere we fall back to os.access.

https://learn.microsoft.com/en-us/windows/win32/api/securitybaseapi/nf-securitybaseapi-accesscheck
"""

from __future__ import annotations

import os

ABSENT, BLOCKED, VISIBLE = "absent", "blocked", "visible"


class _Denied(Exception):
    pass


def path_state(path) -> str:
    """absent, blocked (exists or may exist, but this account cannot read it), or visible."""
    try:
        os.stat(path)
    except PermissionError:
        return BLOCKED
    except OSError:
        return ABSENT
    return VISIBLE if can_read(path) else BLOCKED


def can_read(path) -> bool:
    if os.name != "nt":
        return os.access(path, os.R_OK)
    try:
        return _windows_can_read(str(path))
    except _Denied:
        return False
    except OSError:
        return os.access(path, os.R_OK)


def _windows_can_read(path: str) -> bool:
    import ctypes
    from ctypes import wintypes

    advapi32 = ctypes.WinDLL("advapi32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)

    OWNER_GROUP_DACL = 0x1 | 0x2 | 0x4
    TOKEN_QUERY, TOKEN_DUPLICATE = 0x0008, 0x0002
    SECURITY_IDENTIFICATION = 1
    FILE_GENERIC_READ = 0x00120089
    ERROR_ACCESS_DENIED, ERROR_INSUFFICIENT_BUFFER = 5, 122

    class GENERIC_MAPPING(ctypes.Structure):
        _fields_ = [("GenericRead", wintypes.DWORD), ("GenericWrite", wintypes.DWORD),
                    ("GenericExecute", wintypes.DWORD), ("GenericAll", wintypes.DWORD)]

    advapi32.GetFileSecurityW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, ctypes.c_void_p,
                                          wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
    advapi32.GetFileSecurityW.restype = wintypes.BOOL
    advapi32.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
    advapi32.OpenProcessToken.restype = wintypes.BOOL
    advapi32.DuplicateToken.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.POINTER(wintypes.HANDLE)]
    advapi32.DuplicateToken.restype = wintypes.BOOL
    advapi32.AccessCheck.argtypes = [ctypes.c_void_p, wintypes.HANDLE, wintypes.DWORD,
                                     ctypes.POINTER(GENERIC_MAPPING), ctypes.c_void_p,
                                     ctypes.POINTER(wintypes.DWORD), ctypes.POINTER(wintypes.DWORD),
                                     ctypes.POINTER(wintypes.BOOL)]
    advapi32.AccessCheck.restype = wintypes.BOOL
    kernel32.GetCurrentProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]

    def fail():
        err = ctypes.get_last_error()
        if err == ERROR_ACCESS_DENIED:
            raise _Denied()
        raise OSError(err, "Windows permission check failed")

    # 1. The file's owner, group and DACL (not its contents).
    needed = wintypes.DWORD(0)
    if not advapi32.GetFileSecurityW(path, OWNER_GROUP_DACL, None, 0, ctypes.byref(needed)):
        if ctypes.get_last_error() != ERROR_INSUFFICIENT_BUFFER:
            fail()
    sd = ctypes.create_string_buffer(needed.value)
    if not advapi32.GetFileSecurityW(path, OWNER_GROUP_DACL, sd, needed, ctypes.byref(needed)):
        fail()

    # 2. This process's own token, at identification level (AccessCheck needs
    #    an impersonation-type token; identification is the lowest such level).
    token = wintypes.HANDLE()
    if not advapi32.OpenProcessToken(kernel32.GetCurrentProcess(), TOKEN_QUERY | TOKEN_DUPLICATE,
                                     ctypes.byref(token)):
        fail()
    try:
        ident = wintypes.HANDLE()
        if not advapi32.DuplicateToken(token, SECURITY_IDENTIFICATION, ctypes.byref(ident)):
            fail()
        try:
            # 3. Would this account be granted read access?
            mapping = GENERIC_MAPPING(0x00120089, 0x00120116, 0x001200A0, 0x001F01FF)
            privs = ctypes.create_string_buffer(256)
            privs_len = wintypes.DWORD(256)
            granted = wintypes.DWORD(0)
            status = wintypes.BOOL(False)
            if not advapi32.AccessCheck(sd, ident, FILE_GENERIC_READ, ctypes.byref(mapping), privs,
                                        ctypes.byref(privs_len), ctypes.byref(granted),
                                        ctypes.byref(status)):
                fail()
            return bool(status.value)
        finally:
            kernel32.CloseHandle(ident)
    finally:
        kernel32.CloseHandle(token)
