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
      <h1 className="text-3xl font-semibold">Privacy</h1>
      <p className="mt-3 text-lg">Spare Room works fully offline. Here is exactly what it touches.</p>

      <SectionTitle>What the scan reads</SectionTitle>
      <List items={[
        "Whether known files and folders exist, and whether this account may read them. Readability comes from Windows file permissions, not from opening the file.",
        <>The first 40 bytes of an SSH key file, only to label its type.</>,
        <>The setting names in <Path>.npmrc</Path> (the text before each <Path>=</Path>). Values are skipped.</>,
        <>VS Code&apos;s <Path>settings.json</Path>, to check two settings: Workspace Trust and automatic tasks.</>,
        <>File names on fixed drives while looking for <Path>.env</Path> files. It skips <Path>node_modules</Path> and
          system folders and stops after 50 seconds.</>,
      ]} />

      <SectionTitle>What it never does</SectionTitle>
      <List items={[
        "Print, log, save or send any secret value. A test plants marked fake values and fails if any of them appear in any output.",
        "Use the network. A test checks that the scanner, probe and report import no network code and still work with networking disabled.",
        "Upload, collect telemetry, or ask you to sign in.",
        "Delete or move your files.",
        "Read the contents of another account's files.",
      ]} />

      <SectionTitle>What the account commands change</SectionTitle>
      <div className="space-y-3">
        <Card>
          <p className="font-medium">setup</p>
          <p className="mt-1">Creates one standard (non-administrator) local account after the Windows permission prompt,
            and copies the tool to <Path>C:\Program Files\Spare Room</Path>. You type the password in a Windows
            PowerShell window; it never passes through the tool.</p>
        </Card>
        <Card>
          <p className="font-medium">finish-setup</p>
          <p className="mt-1">Run inside the new account. Edits three settings files there (VS Code, npm, Claude Code)
            and keeps a backup of each.</p>
        </Card>
        <Card>
          <p className="font-medium">remove-account</p>
          <p className="mt-1">Removes the account only if Spare Room created it, never an administrator. It does not
            delete the account&apos;s folder; it tells you how.</p>
        </Card>
      </div>

      <SectionTitle>This website</SectionTitle>
      <List items={[
        "Static pages replaying output recorded from the real tool on a test machine. Paths are redacted, and other people's accounts are left out.",
        "No analytics, no cookies, no trackers. Fonts are served from this site, so your browser contacts no other host.",
      ]} />
    </div>
  );
}
