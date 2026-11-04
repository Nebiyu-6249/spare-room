# Record the Spare Room demo: two titled windows, captured one window at a time.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\record_demo.ps1
#
# Run it from a normal (not administrator) PowerShell in the repo folder.
# It asks for the interview account's credentials with Get-Credential before
# recording starts. The password goes from that dialog straight to Windows to
# open the spare room's window; it is never shown, logged or saved.
# Only the windows this script opens are recorded (ffmpeg gdigrab by window
# title), never the whole desktop. Only demo data and the fake laptop are used.
# Raw clips and timing notes go to demo-video\raw\.
#
# -DryRun records "Your account" running whoami for a few seconds, with no
# credentials; it exists to test capture on this screen.
param([switch]$DryRun)
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$Exe = 'C:\SpareRoomShared\spareroom.exe'
$Work = 'C:\SpareRoomShared\demo'
$Signals = Join-Path $Work 'signal'
$Raw = Join-Path $Repo 'demo-video\raw'
$Ffmpeg = Join-Path $Repo 'tools\video\node_modules\ffmpeg-static\ffmpeg.exe'
$Edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
          "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
$Me = $env:USERNAME
$FakeLaptop = Join-Path $env:USERPROFILE 'SpareRoomTest\fake_laptop'
$SpareUser = 'interview'

Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DemoWin {
    public delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    public static string Find(string part) {
        string found = null;
        EnumWindows(delegate (IntPtr h, IntPtr l) {
            if (!IsWindowVisible(h)) return true;
            var sb = new StringBuilder(512); GetWindowText(h, sb, 512);
            var t = sb.ToString();
            if (t.IndexOf(part, StringComparison.OrdinalIgnoreCase) >= 0) { found = t; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
'@

function Fail([string]$msg) { Write-Host ''; Write-Host "Stopped: $msg" -ForegroundColor Red; exit 1 }
function Signal([string]$name) { New-Item -ItemType File -Force -Path (Join-Path $Signals $name) | Out-Null }
function WaitFor([string]$name, [int]$seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while (-not (Test-Path (Join-Path $Signals $name))) {
        if ((Get-Date) -gt $deadline) { return $false }
        Start-Sleep -Milliseconds 100
    }
    return $true
}
function WaitWindow([string]$part, [int]$seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        $t = [DemoWin]::Find($part)
        if ($t) { return $t }
        Start-Sleep -Milliseconds 200
    }
    return $null
}

$events = New-Object System.Collections.ArrayList
function Start-Clip([string]$windowTitle, [string]$name) {
    $out = Join-Path $Raw "$name.mkv"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Ffmpeg
    # One window only, by its exact title. 30 fps, scaled and padded to 1920x1080.
    $psi.Arguments = "-hide_banner -loglevel error -y -f gdigrab -framerate 30 -draw_mouse 0 -i `"title=$windowTitle`" " +
        "-vf `"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xF2F2F2,format=yuv420p`" " +
        "-c:v libx264 -preset veryfast -crf 16 `"$out`""
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.CreateNoWindow = $true
    # Windows is scaled above 100% here; without this, gdigrab grabs the wrong-sized area.
    $psi.EnvironmentVariables['__COMPAT_LAYER'] = 'HighDpiAware'
    $p = [System.Diagnostics.Process]::Start($psi)
    $clip = [ordered]@{ name = $name; window = $windowTitle; file = $out; started = (Get-Date).ToString('o'); process = $p }
    Start-Sleep -Milliseconds 1500
    if ($p.HasExited) { Fail "ffmpeg could not start recording '$windowTitle'." }
    return $clip
}
function Stop-Clip($clip) {
    $clip.stopped = (Get-Date).ToString('o')
    try { $clip.process.StandardInput.Write('q'); $clip.process.StandardInput.Close() } catch { }
    if (-not $clip.process.WaitForExit(20000)) { $clip.process.Kill() }
    $c = [ordered]@{}; foreach ($k in $clip.Keys) { if ($k -ne 'process') { $c[$k] = $clip[$k] } }
    [void]$events.Add($c)
    $events | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $Raw 'clips.json') -Encoding UTF8
}
function Open-Window([string]$role, [System.Management.Automation.PSCredential]$cred) {
    $cmdline = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$Work\demo_window.ps1`" -Role $role -Config `"$Work\config.json`""
    $conhost = Join-Path $env:SystemRoot 'System32\conhost.exe'
    if (-not $cred) { Start-Process -FilePath $conhost -ArgumentList $cmdline -WorkingDirectory $Work; return }
    try {
        Start-Process -FilePath $conhost -ArgumentList $cmdline -WorkingDirectory $Work -Credential $cred -LoadUserProfile
    } catch {
        Write-Host "Opening the spare room with its profile failed ($($_.Exception.Message)); trying without -LoadUserProfile."
        try { Start-Process -FilePath $conhost -ArgumentList $cmdline -WorkingDirectory $Work -Credential $cred }
        catch { Fail "Windows would not open a window as '$SpareUser': $($_.Exception.Message)" }
    }
}

# --- checks ------------------------------------------------------------------
if (-not (Test-Path $Exe)) { Fail "$Exe not found." }
$ver = (& $Exe --version) -join ''
if ($ver -notmatch '0\.1\.1') { Fail "$Exe is '$ver'; version 0.1.1 is needed (it has doctor)." }
if (-not (Test-Path $Ffmpeg)) { Fail "ffmpeg not found at $Ffmpeg (run npm install in tools\video)." }
if (-not $DryRun) {
    if (-not (Test-Path $FakeLaptop)) { Fail "The fake laptop copy is missing: $FakeLaptop" }
    if (-not $Edge) { Fail 'Microsoft Edge not found; it opens the report in a clean window.' }
    if (-not (Get-LocalUser -Name $SpareUser -ErrorAction SilentlyContinue)) { Fail "No account named '$SpareUser'." }
}

New-Item -ItemType Directory -Force -Path $Work, $Signals, $Raw | Out-Null
Get-ChildItem $Signals -File | Remove-Item -Force
Get-ChildItem $Work -Filter 'timeline-*.json' -File | Remove-Item -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'demo_window.ps1') -Destination $Work -Force
[ordered]@{ exe = $Exe; work = $Work; signals = $Signals; me = $Me; fakeLaptop = $FakeLaptop;
            report = (Join-Path $Work 'report.html') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Work 'config.json') -Encoding UTF8

if ($DryRun) {
    Open-Window 'dry' $null
    $t = WaitWindow 'Your account' 30; if (-not $t) { Fail 'The "Your account" window did not appear.' }
    if (-not (WaitFor 'dry-ready' 30)) { Fail 'The window did not get ready.' }
    $clip = Start-Clip $t 'dryrun'; Signal 'dry-go'
    [void](WaitFor 'dry-done' 60); Start-Sleep -Seconds 1; Stop-Clip $clip; Signal 'dry-close'
    Write-Host "Dry run saved to $Raw\dryrun.mkv"
    exit 0
}

# --- checklist and credentials ------------------------------------------------
Write-Host ''
Write-Host 'Spare Room demo recording' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Before you start:'
Write-Host '  1. Turn on Do Not Disturb (Settings > System > Notifications), so no pop-ups appear.'
Write-Host '  2. Close other windows, especially anything personal.'
Write-Host '  3. Do not touch the mouse or keyboard while it records (about 2 minutes).'
Write-Host ''
Write-Host 'Only the windows this script opens are recorded. Nothing real is scanned on camera:'
Write-Host 'your account runs the demo scan and the fake laptop; the spare room checks itself.'
Write-Host ''
[void](Read-Host 'Press Enter when ready')
$cred = Get-Credential -UserName $SpareUser -Message 'Password for the spare room account. Used only to open its window; not shown or saved.'
if (-not $cred) { Fail 'No credentials given. Nothing was recorded.' }

# --- Window A: your account --------------------------------------------------
Write-Host 'Recording "Your account"...'
Open-Window 'your' $null
$tA = WaitWindow 'Your account' 30; if (-not $tA) { Fail 'The "Your account" window did not appear.' }
if (-not (WaitFor 'your-ready' 30)) { Fail 'The "Your account" window did not get ready.' }
$clipA = Start-Clip $tA 'your-account'
Signal 'your-go'

if (-not (WaitFor 'your-report' 120)) { Fail 'The report step did not start.' }
$edgeData = Join-Path $env:TEMP 'spareroom-demo-edge'
$reportUrl = 'file:///' + ((Join-Path $Work 'report.html') -replace '\\', '/')
Start-Process -FilePath $Edge -ArgumentList @("--user-data-dir=`"$edgeData`"", '--no-first-run', '--no-default-browser-check',
    '--window-position=40,40', '--window-size=1500,950', "--app=$reportUrl")
$tE = WaitWindow 'Spare Room report' 30
if ($tE) {
    $clipE = Start-Clip $tE 'report'
    Start-Sleep -Seconds 6
    Stop-Clip $clipE
} else { Write-Host 'The report window did not appear; continuing without that clip.' }
Get-CimInstance Win32_Process -Filter "Name = 'msedge.exe'" |
    Where-Object { $_.CommandLine -like "*spareroom-demo-edge*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Signal 'report-done'

if (-not (WaitFor 'your-done' 180)) { Fail 'The "Your account" window did not finish.' }
Start-Sleep -Milliseconds 500
Stop-Clip $clipA
Signal 'your-close'

# --- Window B: the spare room ------------------------------------------------
Write-Host 'Recording "The spare room"...'
Open-Window 'spare' $cred
$cred = $null
$tB = WaitWindow 'The spare room' 90; if (-not $tB) { Fail 'The "The spare room" window did not appear.' }
if (-not (WaitFor 'spare-ready' 60)) { Fail 'The spare room window did not get ready.' }
$clipB = Start-Clip $tB 'spare-room'
Signal 'spare-go'
if (-not (WaitFor 'spare-done' 240)) { Fail 'The spare room window did not finish.' }
Start-Sleep -Milliseconds 500
Stop-Clip $clipB
Signal 'spare-close'

Copy-Item -LiteralPath (Join-Path $Work 'timeline-your.json'), (Join-Path $Work 'timeline-spare.json') -Destination $Raw -Force
Remove-Item -Recurse -Force $edgeData -ErrorAction SilentlyContinue
Write-Host ''
Write-Host "Done. Raw clips and timings are in $Raw. Tell Claude to edit them." -ForegroundColor Green
