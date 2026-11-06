// The 13 narration lines, one per shot, in the order the user reads them.
// docs/narration.md shows the same lines; keep the two in step.
export const LINES = [
  "I'm a developer, and recruiters and clients often send me a short coding test before the first call. I want the job, so I open it.",
  "Binance says its six point three billion dollar hack started the same way. An engineer ran a recruiter's coding test on his work laptop.",
  "Here's a test like that, opened in VS Code on my own account. It asks if I trust the authors. Most of us click yes.",
  "Then it asks if the folder's tasks can run. I allow it.",
  "Something starts by itself. This one is harmless, and the secrets are fake. In a few seconds it finds an SSH key, cloud logins, three crypto wallets and saved browser passwords. Thirteen secrets, all in reach. A real one wouldn't just look.",
  "The safe answer is a virtual machine. But setting one up takes an evening, and for a one-hour test, most people skip it.",
  "So I built Spare Room. It creates a spare room: a second Windows account with nothing in it. On my laptop, that took thirty seconds.",
  "Now I'm signed in to the spare room.",
  "First question: can I still do the test here? Node, npm and Git are ready. Python and VS Code need one install, for all users.",
  "Now the same check, against the same thirteen secrets. Blocked. All thirteen.",
  "Spare Room also checks from the inside. All twelve secret locations in my account are out of reach. One dot env file sits in a shared folder, so every account can read it. Spare Room points it out, so I can move it.",
  "You shouldn't have to trust a security tool blindly. Spare Room works with the Wi-Fi off, and it never reads a secret's value.",
  "It's weaker than a virtual machine. It also takes thirty seconds instead of an evening. Thirteen reachable, then zero. Before you run a stranger's code, give it a spare room.",
];

// Spoken length before any audio exists: about 2.75 words a second, plus a
// short breath between sentences.
export function estimateSec(line) {
  const words = line.split(/\s+/).filter(Boolean).length;
  const sentences = (line.match(/[.!?:](\s|$)/g) || []).length;
  return words / 2.75 + 0.25 * Math.max(0, sentences - 1);
}
