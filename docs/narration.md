# Narration for the demo video (optional)

The video (web/public/real-demo.mp4, 1:51) already has captions burned in, so
narration is optional. If you record it, I mix it under the video, and I can
stretch a shot by a second or two if a line runs long.

Read in your normal voice, a little slower than talking. Each line has the time
its shot is on screen and a rough word budget (about 2.5 words per second).

| # | Shot (time) | Line |
|---|-------------|------|
| 1 | Title card (0:00-0:05) | Spare Room: run a recruiter's code in a room with nothing in it. |
| 2 | Binance card (0:05-0:12) | Binance's 6.34 billion dollar loss involved an engineer who ran a recruiter's coding test on his work computer. |
| 3 | VS Code trust question (0:12-0:17) | I open a recruiter's test repo in VS Code, in my own account. |
| 4 | Allow tasks (0:17-0:21) | I trust it, and I let its tasks run. |
| 5 | Task output (0:21-0:39) | A task starts by itself. This one is harmless. It only checks whether thirteen fake secrets exist and can be read: SSH keys, cloud logins, wallets, a dot env file. From my account, it reaches all thirteen. |
| 6 | Ping with Wi-Fi off (0:39-0:43) | Now the Wi-Fi is off. The ping fails. |
| 7 | Offline scan (0:43-0:55) | Spare Room's scan of a fake laptop still finishes. It works fully offline, and it never opens a secret. It only notes where one sits. |
| 8 | Setup time card (0:55-1:01) | Creating the spare room, a second Windows account, took under thirty seconds. |
| 9 | whoami (1:01-1:04) | Now I'm inside the spare room. |
| 10 | doctor (1:04-1:17) | Doctor checks whether the coding test can run here. Node, npm and Git are ready. Python and VS Code need installing once, for all users. |
| 11 | probe (1:17-1:28) | The same check, from here, against the same thirteen fake secrets in my account's folder. All thirteen blocked. |
| 12 | verify (1:28-1:44) | Verify, run from inside the spare room, checks my real account. Twelve of twelve secret locations are out of reach. One dot env file sits outside any account folder, so every account can read it. |
| 13 | End card (1:44-1:51) | Thirteen reachable, then zero. Weaker than a virtual machine, but set up in under thirty seconds. |

Do not read out the project folder name in line 12. The video hides it.

## Recording it with Windows Sound Recorder

1. Plug in a headset or USB mic if you have one, and go to a quiet room.
2. Open Start, type **Sound Recorder** and open it. (On older Windows 11 builds
   it is called Voice Recorder.)
3. Pick your microphone in the list at the bottom left. Set the format to
   **m4a** or **wav** if the app offers a choice.
4. Press the record button (or Ctrl+R). Wait two seconds before you speak.
5. Read the lines in order. **Pause about two seconds between lines**. You do
   not need to keep up with the video: I cut the file at the pauses and place
   each line at the start of its shot.
6. If you stumble, stop, pause two seconds and read that whole line again. Say
   "again" before you do, and I will keep the last take.
7. Press stop. The file goes to Documents\Sound recordings.
8. Copy it to `demo-video\narration.m4a` (or `.wav`) in this repo and tell me.
   That folder is not published or committed.

If you would rather not narrate, the video stays as it is, with captions only.
