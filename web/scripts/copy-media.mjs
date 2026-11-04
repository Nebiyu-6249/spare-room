// Copy the demo video from demo-video/ into public/video before a build, and
// turn its SRT captions into a WebVTT track for the <video> element.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(WEB, "..", "demo-video");
const DEST = join(WEB, "public", "video");

await mkdir(DEST, { recursive: true });
await copyFile(join(SRC, "spare-room-walkthrough.mp4"), join(DEST, "spare-room-walkthrough.mp4"));
const srt = await readFile(join(SRC, "spare-room-walkthrough.srt"), "utf8");
const vtt = "WEBVTT\n\n" + srt.replace(/\r/g, "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
await writeFile(join(DEST, "spare-room-walkthrough.vtt"), vtt, "utf8");
console.log("Copied demo video and captions to public/video");
