import type { Metadata } from "next";
import { Card, Path, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy | Spare Room" };

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

export default function Privacy() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-semibold">Privacy</h1>
      <p className="mt-3 text-lg">Spare Room works fully offline. Here is exactly what it touches.</p>

      <SectionTitle>What the scan reads</SectionTitle>
      <List items={[
        "Whether known files and folders exist, and whether your account may read them. Readability comes from Windows file permissions, not from opening the file.",
        <>The first 40 bytes of an SSH key file, only to label its type.</>,
        <>The setting names in <Path>.npmrc</Path> (the text before each <Path>=</Path>). Values are skipped.</>,
        <>VS Code&apos;s <Path>settings.json</Path>, to check two settings: Workspace Trust and automatic tasks.</>,
        <>File names on fixed drives while looking for <Path>.env</Path> files. It skips <Path>node_modules</Path> and
          system folders and stops after 50 seconds.</>,
      ]} />

      <SectionTitle>What it never does</SectionTitle>
      <List items={[
        "Print, log, save or send any secret value. A test plants marked fake values and fails if any of them appear in any output.",
        "Use the network. A test checks that the scanning code imports no network code and still works with networking switched off.",
        "Upload, collect telemetry, or ask you to sign in.",
        "Delete or move your files.",
        "Read the contents of another account's files.",
      ]} />

      <SectionTitle>What changes on your PC</SectionTitle>
      <div className="space-y-3">
        <Card>
          <h3 className="font-medium">Creating the spare room</h3>
          <p className="mt-1">One standard (non-administrator) Windows account is added after the Windows permission
            prompt, and the tool is copied to <Path>C:\Program Files\Spare Room</Path>. You type the password in a
            Windows PowerShell window; it never passes through the tool.</p>
        </Card>
        <Card>
          <h3 className="font-medium">First time inside the spare room</h3>
          <p className="mt-1">Three settings files there are changed (VS Code, npm, Claude Code), and a backup of each
            is kept. Then it checks what is still reachable from the spare room.</p>
        </Card>
        <Card>
          <h3 className="font-medium">Removing the spare room</h3>
          <p className="mt-1">The account is removed only if Spare Room created it, and never an administrator. Its
            folder is not deleted; the tool tells you how to delete it.</p>
        </Card>
      </div>

      <SectionTitle>This website</SectionTitle>
      <List items={[
        "Static pages replaying output recorded from the real tool on a test machine. Paths are redacted, and other people's accounts are left out.",
        "No analytics, no cookies, no trackers. Fonts and the video are served from this site, so your browser contacts no other host.",
      ]} />
    </div>
  );
}
