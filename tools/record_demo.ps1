# Record the Spare Room demo, one window at a time, with on-screen prompts.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\record_demo.ps1
#
# Run it from a normal (not administrator) PowerShell in the repo folder.
#   A. Your account: VS Code opens traps\vscode_task (throwaway profile). You
#      click Trust; the folder-open task runs and prints 13 reachable.
#   B. Your account, offline: you turn Wi-Fi off; a ping fails and the demo
#      scan completes; you turn Wi-Fi back on. Recording pauses while you click.
#   C. The spare room: whoami, doctor, the probe (13 blocked), verify.
# The interview account's password goes from a Get-Credential dialog straight
# to Windows to open its window; it is never shown, logged or saved.
# Only the windows this script opens are recorded: consoles by window title,
# VS Code by the screen area under its window (it draws with the GPU, which
# title capture cannot read). Prompts appear in a box outside that area.
# Only demo data and the fake laptop are used. Clips go to demo-video\raw\.
#
# -DryRun opens VS Code for a few seconds and records it, with no credentials
# and no clicks, to test capture on this screen.
param([switch]$DryRun)
$ErrorActionPreference = 'Stop'

$Repo = Split-Path -Parent $PSScriptRoot
$Exe = 'C:\SpareRoomShared\spareroom.exe'
$Work = 'C:\SpareRoomShared\demo'
$Signals = Join-Path $Work 'signal'
$Raw = Join-Path $Repo 'demo-video\raw'
$Ffmpeg = Join-Path $Repo 'tools\video\node_modules\ffmpeg-static\ffmpeg.exe'
$Code = @("$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe", "$env:ProgramFiles\Microsoft VS Code\Code.exe") |
    Where-Object { Test-Path $_ } | Select-Object -First 1
$Trap = Join-Path $Repo 'traps\vscode_task'
$Me = $env:USERNAME
$FakeLaptop = Join-Path $env:USERPROFILE 'SpareRoomTest\fake_laptop'
$SpareUser = 'interview'
$VsData = Join-Path $env:TEMP 'spareroom-demo-vscode'
# Where VS Code is placed and recorded, in physical pixels (16:9), and where the
# prompt box goes (below it, never inside the recorded area).
$VsRect = @(40, 40, 2160, 1215)
$PromptY = 1300

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class DemoWin {
    public delegate bool EnumProc(IntPtr h, IntPtr l);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
    public static IntPtr Handle(string part) {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate (IntPtr h, IntPtr l) {
            if (!IsWindowVisible(h)) return true;
            var sb = new StringBuilder(512); GetWindowText(h, sb, 512);
            if (sb.ToString().IndexOf(part, StringComparison.OrdinalIgnoreCase) >= 0) { found = h; return false; }
            return true;
        }, IntPtr.Zero);
        return found;
    }
    public static string Title(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
    public static void Place(IntPtr h, int x, int y, int w, int hh) {
        ShowWindow(h, 9); SetWindowPos(h, IntPtr.Zero, x, y, w, hh, 0x0040); SetForegroundWindow(h);
    }
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out RECT r, int size);
    // What is actually drawn on screen (without the invisible resize borders).
    public static int[] Visible(IntPtr h) {
        RECT r; if (DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT))) != 0) return null;
        return new int[] { r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top };
    }
}
'@
[void][DemoWin]::SetProcessDPIAware()   # all coordinates in physical pixels, as ffmpeg sees them

function Fail([string]$msg) { Write-Host ''; Write-Host "Stopped: $msg" -ForegroundColor Red; Stop-AllRecording; Cleanup-VsCode; exit 1 }
function Signal([string]$name) { New-Item -ItemType File -Force -Path (Join-Path $Signals $name) | Out-Null }
function WaitFor([string]$name, [int]$seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while (-not (Test-Path (Join-Path $Signals $name))) {
        if ((Get-Date) -gt $deadline) { return $false }
        Start-Sleep -Milliseconds 100
    }
    return $true
}
function WaitHandle([string]$part, [int]$seconds) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        $h = [DemoWin]::Handle($part)
        if ($h -ne [IntPtr]::Zero) { return $h }
        Start-Sleep -Milliseconds 200
    }
    return [IntPtr]::Zero
}

$events = New-Object System.Collections.ArrayList
function Note([string]$what) {
    [void]$events.Add([ordered]@{ event = $what; at = (Get-Date).ToString('o') })
    $events | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $Raw 'events.json') -Encoding UTF8
}
$clips = New-Object System.Collections.ArrayList
$Active = New-Object System.Collections.ArrayList   # ffmpeg processes recording right now

# Stop every recording this script started. Runs on any exit, Ctrl+C included,
# so ffmpeg never keeps recording the screen after the script has gone.
function Stop-AllRecording {
    foreach ($p in @($Active)) {
        try { if (-not $p.HasExited) { $p.StandardInput.Write('q'); $p.StandardInput.Close(); if (-not $p.WaitForExit(5000)) { $p.Kill() } } } catch { try { $p.Kill() } catch { } }
    }
    $Active.Clear()
}
# A run that was stopped earlier may have left ffmpeg recording; stop it first.
function Stop-LeftoverRecording {
    Get-CimInstance Win32_Process -Filter "Name = 'ffmpeg.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like '*gdigrab*' -and $_.CommandLine -like "*$Raw*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
}

function Start-Clip([string]$name, [string]$windowTitle, [int[]]$rect = $null) {
    $out = Join-Path $Raw "$name.mkv"
    if ($rect) {
        $w = $rect[2] - ($rect[2] % 2); $h = $rect[3] - ($rect[3] % 2)
        $source = "-offset_x $($rect[0]) -offset_y $($rect[1]) -video_size ${w}x${h} -i desktop"
    } else { $source = "-i `"title=$windowTitle`"" }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Ffmpeg
    $psi.Arguments = "-hide_banner -loglevel error -y -f gdigrab -framerate 30 -draw_mouse 1 $source " +
        "-vf `"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xF2F2F2,format=yuv420p`" " +
        "-c:v libx264 -preset veryfast -crf 16 `"$out`""
    $psi.UseShellExecute = $false; $psi.RedirectStandardInput = $true; $psi.CreateNoWindow = $true
    $psi.EnvironmentVariables['__COMPAT_LAYER'] = 'HighDpiAware'   # Windows is scaled above 100% here
    $p = [System.Diagnostics.Process]::Start($psi)
    [void]$Active.Add($p)
    $clip = [ordered]@{ name = $name; window = $windowTitle; rect = $rect; file = $out; started = (Get-Date).ToString('o'); process = $p }
    Start-Sleep -Milliseconds 1500
    if ($p.HasExited) { Fail "ffmpeg could not start recording $name." }
    return $clip
}
function Stop-Clip($clip) {
    $clip.stopped = (Get-Date).ToString('o')
    try { $clip.process.StandardInput.Write('q'); $clip.process.StandardInput.Close() } catch { }
    if (-not $clip.process.WaitForExit(20000)) { $clip.process.Kill() }
    $Active.Remove($clip.process)
    $c = [ordered]@{}; foreach ($k in $clip.Keys) { if ($k -ne 'process') { $c[$k] = $clip[$k] } }
    [void]$clips.Add($c)
    $clips | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $Raw 'clips.json') -Encoding UTF8
}

# A prompt box below the recorded area. Blocks until Continue (or Enter) or
# Stop recording is pressed. Returns 'continue', 'stop', or 'closed' (the
# watched window went away). With -Watch, it checks five times a second that
# the window being recorded still exists, so a closed window is not filmed past.
function Show-Prompt([string]$heading, [string]$text, [int]$autoCloseSeconds = 0, [IntPtr]$Watch = [IntPtr]::Zero) {
    Note "prompt: $heading"
    $f = New-Object Windows.Forms.Form
    $f.Text = 'Spare Room recording'; $f.TopMost = $true; $f.FormBorderStyle = 'FixedDialog'
    $f.MaximizeBox = $false; $f.MinimizeBox = $false; $f.StartPosition = 'Manual'
    $f.Location = New-Object Drawing.Point($VsRect[0], $PromptY); $f.Size = New-Object Drawing.Size($VsRect[2], 270)
    $f.BackColor = [Drawing.Color]::FromArgb(250, 250, 247)
    $h = New-Object Windows.Forms.Label; $h.Text = $heading; $h.Font = New-Object Drawing.Font('Segoe UI', 15, [Drawing.FontStyle]::Bold)
    $h.AutoSize = $true; $h.Location = New-Object Drawing.Point(24, 16)
    $l = New-Object Windows.Forms.Label; $l.Text = $text; $l.Font = New-Object Drawing.Font('Segoe UI', 12)
    $l.Location = New-Object Drawing.Point(24, 70); $l.Size = New-Object Drawing.Size(($VsRect[2] - 340), 170)
    $b = New-Object Windows.Forms.Button; $b.Text = 'Continue'; $b.Font = New-Object Drawing.Font('Segoe UI', 13)
    $b.Size = New-Object Drawing.Size(240, 80); $b.Location = New-Object Drawing.Point(($VsRect[2] - 290), 90)
    $b.DialogResult = [Windows.Forms.DialogResult]::OK
    $s = New-Object Windows.Forms.Button; $s.Text = 'Stop recording'; $s.Font = New-Object Drawing.Font('Segoe UI', 11)
    $s.Size = New-Object Drawing.Size(240, 56); $s.Location = New-Object Drawing.Point(($VsRect[2] - 290), 182)
    $s.DialogResult = [Windows.Forms.DialogResult]::Abort
    $f.Controls.AddRange(@($h, $l, $b, $s)); $f.AcceptButton = $b
    $state = @{ closed = $false }
    if ($autoCloseSeconds -gt 0) {
        $t = New-Object Windows.Forms.Timer; $t.Interval = $autoCloseSeconds * 1000
        $t.Add_Tick({ $f.Close() }); $t.Start()
    }
    if ($Watch -ne [IntPtr]::Zero) {
        $w = New-Object Windows.Forms.Timer; $w.Interval = 200
        $w.Add_Tick({ if (-not [DemoWin]::IsWindow($Watch)) { $state.closed = $true; $f.Close() } }.GetNewClosure()); $w.Start()
    }
    $r = $f.ShowDialog()
    $result = if ($state.closed) { 'closed' } elseif ($r -eq [Windows.Forms.DialogResult]::Abort) { 'stop' } else { 'continue' }
    Note "$result : $heading"
    return $result
}

function Network-Up { @(Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object Status -eq 'Up').Count -gt 0 }

function Open-Console([string]$role, [System.Management.Automation.PSCredential]$cred) {
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

# VS Code with a throwaway profile: no recent folders, accounts or extensions on
# screen, and a fresh Workspace Trust state, so it asks about this folder.
function Start-VsCode {
    Remove-Item -Recurse -Force $VsData -ErrorAction SilentlyContinue
    New-Item -ItemType Directory -Force -Path "$VsData\data\User", "$VsData\ext" | Out-Null
    # Setting ids checked against the installed VS Code's own workbench code.
    [ordered]@{
        'security.workspace.trust.startupPrompt' = 'once'
        'workbench.startupEditor' = 'none'
        'workbench.welcomePage.experimentalOnboarding' = $false   # no Copilot sign-in screen
        'chat.disableAIFeatures' = $true
        'workbench.colorTheme' = 'Default Light Modern'
        'workbench.tips.enabled' = $false
        'window.zoomLevel' = 1
        'terminal.integrated.fontSize' = 16
        'telemetry.telemetryLevel' = 'off'
        'update.mode' = 'none'
        'git.enabled' = $false                                     # no "git repository found" notification
        'git.openRepositoryInParentFolders' = 'never'
    } | ConvertTo-Json | Set-Content -LiteralPath "$VsData\data\User\settings.json" -Encoding UTF8
    Start-Process -FilePath $Code -ArgumentList @("--user-data-dir=`"$VsData\data`"", "--extensions-dir=`"$VsData\ext`"",
        '--new-window', "`"$Trap`"") -RedirectStandardOutput "$VsData\code-out.log" -RedirectStandardError "$VsData\code-err.log"
    $h = WaitHandle 'vscode_task' 60
    if ($h -eq [IntPtr]::Zero) { Fail 'VS Code did not open traps\vscode_task.' }
    $script:VsHandle = $h
    Start-Sleep -Seconds 2
    [DemoWin]::Place($h, $VsRect[0], $VsRect[1], $VsRect[2], $VsRect[3])
    Start-Sleep -Seconds 2
    $v = [DemoWin]::Visible($h)
    if (-not $v) { Fail 'Could not measure the VS Code window.' }
    # Record exactly what is drawn, 1 px inside its edge.
    return @(($v[0] + 1), ($v[1] + 1), ($v[2] - 2), ($v[3] - 2))
}
function Cleanup-VsCode {
    Get-CimInstance Win32_Process -Filter "Name = 'Code.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*spareroom-demo-vscode*" } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 800
    Remove-Item -Recurse -Force $VsData -ErrorAction SilentlyContinue
}

# --- checks ------------------------------------------------------------------
if (-not (Test-Path $Exe)) { Fail "$Exe not found." }
$ver = (& $Exe --version) -join ''
if ($ver -notmatch '0\.1\.2') { Fail "$Exe is '$ver'; version 0.1.2 is needed." }
if (-not (Test-Path $Ffmpeg)) { Fail "ffmpeg not found at $Ffmpeg (run npm install in tools\video)." }
if (-not $Code) { Fail 'VS Code (Code.exe) not found.' }
if (-not (Test-Path (Join-Path $Trap '.vscode\tasks.json'))) { Fail 'traps\vscode_task is missing.' }
if (-not $DryRun) {
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) { Fail 'python is not on PATH; the VS Code trap task needs it.' }
    if (-not (Test-Path $FakeLaptop)) { Fail "The fake laptop copy is missing: $FakeLaptop" }
    if (-not (Get-LocalUser -Name $SpareUser -ErrorAction SilentlyContinue)) { Fail "No account named '$SpareUser'." }
}

New-Item -ItemType Directory -Force -Path $Work, $Signals, $Raw | Out-Null
Stop-LeftoverRecording
Get-ChildItem $Signals -File | Remove-Item -Force
Get-ChildItem $Work -Filter 'timeline-*.json' -File | Remove-Item -Force
Get-ChildItem $Raw -File -ErrorAction SilentlyContinue | Remove-Item -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'demo_window.ps1') -Destination $Work -Force
[ordered]@{ exe = $Exe; work = $Work; signals = $Signals; me = $Me; fakeLaptop = $FakeLaptop } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Work 'config.json') -Encoding UTF8

try {   # every path out of here, Ctrl+C included, ends in the finally block below

if ($DryRun) {
    $vsRec = Start-VsCode
    $clip = Start-Clip 'dry-vscode' $null $vsRec
    # Close VS Code from outside after 3 s: the prompt must notice and return 'closed'.
    $job = Start-Job { Start-Sleep -Seconds 3
        Get-CimInstance Win32_Process -Filter "Name = 'Code.exe'" | Where-Object { $_.CommandLine -like '*spareroom-demo-vscode*' } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } }
    $r = Show-Prompt 'Prompt test' 'VS Code will be closed in 3 seconds; this box should close at once when it does.' 15 -Watch $script:VsHandle
    Stop-Clip $clip
    Remove-Job $job -Force
    Cleanup-VsCode
    Write-Host "Dry run: prompt returned '$r'. Saved to $Raw\dry-vscode.mkv"
    exit 0
}

# --- checklist and credentials ------------------------------------------------
Write-Host ''
Write-Host 'Spare Room demo recording' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Before you start:'
Write-Host '  1. Turn on Do Not Disturb (Settings > System > Notifications), so no pop-ups appear.'
Write-Host '  2. Close other windows, especially anything personal, and close VS Code.'
Write-Host '  3. A box at the bottom of the screen tells you whenever to click. Otherwise do not'
Write-Host '     touch the mouse or keyboard. It takes about 4 minutes.'
Write-Host ''
Write-Host 'Only the windows this script opens are recorded, and only demo data and the fake'
Write-Host 'laptop are used. Recording pauses while you change Wi-Fi.'
Write-Host ''
[void](Read-Host 'Press Enter when ready')
$cred = Get-Credential -UserName $SpareUser -Message 'Password for the spare room account. Used only to open its window; not shown or saved.'
if (-not $cred) { Fail 'No credentials given. Nothing was recorded.' }

# --- A. VS Code opens the trap folder in your account --------------------------
Write-Host 'A. VS Code...'
$vsRec = Start-VsCode
$clipV = Start-Clip 'vscode' $null $vsRec
Note 'vscode recording'
$r = Show-Prompt 'Your turn: VS Code' ("1. In VS Code, click 'Yes, I trust the authors'.`n" +
    "2. A message at the bottom right asks whether to allow automatic tasks. Click Allow.`n" +
    "3. A terminal opens at the bottom of VS Code. When it shows 'visible: 13' and the list, click Continue here.`n" +
    "If nothing happens within a minute, click Stop recording.") -Watch $script:VsHandle
if ($r -eq 'closed') { Fail 'VS Code was closed, so recording stopped at once. Run the script again.' }
if ($r -eq 'stop') { Fail 'Stopped at your request.' }
Start-Sleep -Seconds 2
Stop-Clip $clipV
Cleanup-VsCode

# --- B. Offline: the demo scan with Wi-Fi off ----------------------------------
Write-Host 'B. Offline scan...'
$r = Show-Prompt 'Your turn: turn Wi-Fi off' ("Recording is paused. Turn Wi-Fi off now (click the network icon on the taskbar, then Wi-Fi). " +
    "If a network cable is plugged in, unplug it. Then click Continue.")
if ($r -eq 'stop') { Fail 'Stopped at your request.' }
if (Network-Up) {
    $r = Show-Prompt 'A network still looks connected' ("Windows still reports a connected network adapter. Turn it off, then click Continue " +
        "(the recording will go ahead either way).")
    if ($r -eq 'stop') { Fail 'Stopped at your request.' }
}
Note ("network up after prompt: " + (Network-Up))
Open-Console 'offline' $null
$tA = WaitHandle 'Your account' 30; if ($tA -eq [IntPtr]::Zero) { Fail 'The "Your account" window did not appear.' }
if (-not (WaitFor 'offline-ready' 30)) { Fail 'The "Your account" window did not get ready.' }
$clipA = Start-Clip 'offline' 'Your account'
Signal 'offline-go'
if (-not (WaitFor 'offline-done' 120)) { Fail 'The offline scan did not finish.' }
Start-Sleep -Milliseconds 500
Stop-Clip $clipA
Signal 'offline-close'
[void](Show-Prompt 'Your turn: turn Wi-Fi back on' 'Recording is paused. Turn Wi-Fi back on (and plug the cable back in, if you unplugged one). Then click Continue.')

# --- C. The spare room ---------------------------------------------------------
Write-Host 'C. The spare room...'
Open-Console 'spare' $cred
$cred = $null
$tB = WaitHandle 'The spare room' 90; if ($tB -eq [IntPtr]::Zero) { Fail 'The "The spare room" window did not appear.' }
if (-not (WaitFor 'spare-ready' 60)) { Fail 'The spare room window did not get ready.' }
$clipB = Start-Clip 'spare-room' 'The spare room'
Signal 'spare-go'
if (-not (WaitFor 'spare-done' 240)) { Fail 'The spare room window did not finish.' }
Start-Sleep -Milliseconds 500
Stop-Clip $clipB
Signal 'spare-close'

Copy-Item -LiteralPath (Join-Path $Work 'timeline-offline.json'), (Join-Path $Work 'timeline-spare.json') -Destination $Raw -Force
Write-Host ''
Write-Host "Done. Raw clips and timings are in $Raw. Tell Claude to edit them." -ForegroundColor Green

} finally {
    # Never leave ffmpeg recording, or the demo VS Code open, whatever happened above.
    Stop-AllRecording
    Cleanup-VsCode
}
