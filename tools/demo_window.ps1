# One titled demo window for tools/record_demo.ps1. Do not run it by hand.
# -Role your  : "Your account"   (runs as you)
# -Role spare : "The spare room" (runs as the interview account)
# -Role dry   : "Your account", whoami only (a short capture test)
# It shows each command, then runs it for real against demo data or the fake
# laptop only, and writes a timeline so the recording can be cut precisely.
param(
    [Parameter(Mandatory = $true)][ValidateSet('your', 'spare', 'dry')][string]$Role,
    [Parameter(Mandatory = $true)][string]$Config
)
$ErrorActionPreference = 'Continue'
$cfg = Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
$sig = $cfg.signals
$title = if ($Role -eq 'spare') { 'The spare room' } else { 'Your account' }

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class DemoConsole {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct FontInfo {
        public uint cbSize; public uint nFont; public short X; public short Y;
        public int FontFamily; public int FontWeight;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string FaceName;
    }
    [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int n);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern bool SetCurrentConsoleFontEx(IntPtr h, bool max, ref FontInfo f);
    [DllImport("kernel32.dll")] static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    public static bool SetFont(string face, short height) {
        var f = new FontInfo(); f.cbSize = (uint)Marshal.SizeOf(f);
        f.FaceName = face; f.Y = height; f.FontFamily = 54; f.FontWeight = 400;
        return SetCurrentConsoleFontEx(GetStdHandle(-11), false, ref f);
    }
    public static void MoveTo(int x, int y) { SetWindowPos(GetConsoleWindow(), IntPtr.Zero, x, y, 0, 0, 0x0001 | 0x0004); }
}
'@

# Look: light background, ink text, monospace at 20 px (before Windows scaling).
# 142 columns fit the longest fake-laptop path on one line.
$raw = $Host.UI.RawUI
$raw.WindowTitle = $title
$raw.BackgroundColor = 'White'
$raw.ForegroundColor = 'Black'
[void][DemoConsole]::SetFont('Consolas', 20)
Start-Sleep -Milliseconds 300
$max = $raw.MaxPhysicalWindowSize
$cols = [Math]::Min(142, $max.Width)
$rows = [Math]::Min(32, $max.Height)
try {
    $raw.BufferSize = New-Object Management.Automation.Host.Size([Math]::Max($cols, $raw.BufferSize.Width), 3000)
    $raw.WindowSize = New-Object Management.Automation.Host.Size($cols, $rows)
    $raw.BufferSize = New-Object Management.Automation.Host.Size($cols, 3000)
} catch { }
[DemoConsole]::MoveTo(24, 24)
try { [Console]::CursorVisible = $false } catch { }
Clear-Host

function Signal([string]$name) { New-Item -ItemType File -Force -Path (Join-Path $sig $name) | Out-Null }
function WaitFor([string]$name, [int]$seconds = 120) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while (-not (Test-Path (Join-Path $sig $name))) {
        if ((Get-Date) -gt $deadline) { return $false }
        Start-Sleep -Milliseconds 100
    }
    return $true
}

function spareroom { & $cfg.exe @args }

$timeline = New-Object System.Collections.ArrayList
function Step([string]$shown, [scriptblock]$run, [double]$pause) {
    Clear-Host
    $start = Get-Date
    Write-Host -NoNewline -ForegroundColor DarkBlue 'PS> '
    foreach ($ch in $shown.ToCharArray()) { Write-Host -NoNewline -ForegroundColor DarkBlue $ch; Start-Sleep -Milliseconds 18 }
    Write-Host ''
    $typed = Get-Date
    & $run | Out-Host   # show output as it comes, not when the step returns
    $ran = Get-Date
    Start-Sleep -Milliseconds ([int]($pause * 1000))
    [void]$timeline.Add([ordered]@{ command = $shown; start = $start.ToString('o'); typed = $typed.ToString('o');
        output_done = $ran.ToString('o'); end = (Get-Date).ToString('o') })
    $timeline | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $cfg.work "timeline-$Role.json") -Encoding UTF8
}

Signal "$Role-ready"
if (-not (WaitFor "$Role-go" 120)) { exit 1 }
Start-Sleep -Milliseconds 600

switch ($Role) {
    'dry' {
        Step 'whoami' { whoami } 2
    }
    'your' {
        Step 'whoami' { whoami } 3
        Step 'spareroom scan --demo | Select-Object -First 26' { spareroom scan --demo | Select-Object -First 26 } 7
        Step "spareroom report --demo --no-open --out $($cfg.report)" {
            spareroom report --demo --no-open --out $cfg.report
            Write-Host ''
            Write-Host 'Opening the report in the browser...'
            Signal 'your-report'
            [void](WaitFor 'report-done' 60)
        } 0.5
        Step "spareroom probe --fake-laptop $($cfg.fakeLaptop)" { spareroom probe --fake-laptop $cfg.fakeLaptop } 8
    }
    'spare' {
        Step 'whoami' { whoami } 3
        Step 'spareroom doctor' { spareroom doctor } 8
        Step "spareroom probe --fake-laptop $($cfg.fakeLaptop)" { spareroom probe --fake-laptop $cfg.fakeLaptop } 8
        Step "spareroom verify --only-profile $($cfg.me)" { spareroom verify --only-profile $cfg.me } 9
    }
}

Signal "$Role-done"
[void](WaitFor "$Role-close" 60)
