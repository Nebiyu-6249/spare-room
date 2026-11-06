# Narration for the demo video

The video (web/public/real-demo.mp4) has captions burned in and works without
sound. If you record these lines, `tools/video/narration.mjs` splits your
recording and `tools/video/edit.mjs` mixes it in, sizing each shot to its line
plus about half a second. The lines are also in `tools/video/script.mjs`; keep
the two in step.

Read in your normal voice, a little slower than talking.

| # | Shot | Line |
|---|------|------|
| 1 | Card: the recruiter message | I'm a developer, and recruiters and clients often send me a short coding test before the first call. I want the job, so I open it. |
| 2 | Card: Binance, with its source | Binance says its six point three billion dollar hack started the same way. An engineer ran a recruiter's coding test on his work laptop. |
| 3 | VS Code asks about trusting the authors | Here's a test like that, opened in VS Code on my own account. It asks if I trust the authors. Most of us click yes. |
| 4 | VS Code asks about automatic tasks | Then it asks if the folder's tasks can run. I allow it. |
| 5 | The task's output: 13 visible | Something starts by itself. This one is harmless, and the secrets are fake. In a few seconds it finds an SSH key, cloud logins, three crypto wallets and saved browser passwords. Thirteen secrets, all in reach. A real one wouldn't just look. |
| 6 | Card: the virtual machine | The safe answer is a virtual machine. But setting one up takes an evening, and for a one-hour test, most people skip it. |
| 7 | Card: setup took 29.6 s | So I built Spare Room. It creates a spare room: a second Windows account with nothing in it. On my laptop, that took thirty seconds. |
| 8 | whoami in the spare room | Now I'm signed in to the spare room. |
| 9 | doctor | First question: can I still do the test here? Node, npm and Git are ready. Python and VS Code need one install, for all users. |
| 10 | probe: 13 blocked | Now the same check, against the same thirteen secrets. Blocked. All thirteen. |
| 11 | verify | Spare Room also checks from the inside. All twelve secret locations in my account are out of reach. One dot env file sits in a shared folder, so every account can read it. Spare Room points it out, so I can move it. |
| 12 | Wi-Fi off: the ping fails, the demo scan completes | You shouldn't have to trust a security tool blindly. Spare Room works with the Wi-Fi off, and it never reads a secret's value. |
| 13 | End card | It's weaker than a virtual machine. It also takes thirty seconds instead of an evening. Thirteen reachable, then zero. Before you run a stranger's code, give it a spare room. |

In line 10, leave a short beat after "Blocked." The edit adds one more second
of quiet after the line.

Don't read out the project folder name or the computer name; the video
covers both.

## Recording with Windows Sound Recorder

1. Use a headset or USB mic if you have one, in a quiet room.
2. Open Start, type **Sound Recorder** and open it. On older Windows 11 builds
   it is called Voice Recorder.
3. Pick your microphone at the bottom left.
4. Press record (Ctrl+R) and wait two seconds before you speak.
5. Read the 13 lines in order, with **about two seconds of silence between
   lines**. You don't need to keep up with the video.
6. If you stumble, pause, say **"again"**, pause, and read the whole line again.
   The last take is kept.
7. Press stop. The file goes to Documents\Sound recordings.
8. Copy it into this repo as `demo-video\narration.m4a`. It is never committed
   or published.

## Mixing it in (done by Claude)

    cd tools/video
    node narration.mjs     # split at the pauses, drop "again" takes, light noise reduction
    node edit.mjs          # place each line at the start of its shot, -16 LUFS, no music

`narration.mjs` stops without writing anything if it doesn't find exactly 13
lines. A `demo-video/narration-work/map.json` then sets them by hand: either
`{"keep": [piece numbers]}` to pick takes, or `{"lines": [[start, end], ...]}`
with each line's times in seconds, for a reading without long pauses. The
narration in the current video (a generated voice, 1:51, no long pauses) was
split that way, with the boundaries found from its short pauses and checked by
transcribing each piece offline with Windows speech recognition. Audio that is
already clean (noise floor under -70 dB) skips noise reduction.
