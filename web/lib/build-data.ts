// Read at build time only (server components). Optional inputs that may not
// exist yet: the real screen recording and the doctor output recorded in the
// spare room. When a file is missing, its section is simply left out.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

export function realVideo(): { src: string; captions: string | null } | null {
  const pub = path.join(ROOT, "public");
  if (!fs.existsSync(path.join(pub, "real-demo.mp4"))) return null;
  return { src: "/real-demo.mp4", captions: fs.existsSync(path.join(pub, "real-demo.vtt")) ? "/real-demo.vtt" : null };
}

export type DoctorTool = {
  name: string;
  label: string;
  found: boolean;
  scope: string | null;
  version: string | null;
  note: string;
  install: string;
};
export type DoctorRun = { ran_at: string; tools: DoctorTool[] };

export function doctorRun(): DoctorRun | null {
  const f = path.join(ROOT, "data", "doctor.json");
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, "utf8")) as DoctorRun;
}
