import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHero } from "@/components/Hero";
import { Band, Path, SectionTitle } from "@/components/ui";
import { DOWNLOAD_URL, fileSize, recorded, RELEASE_URL, REPO_URL } from "@/lib/data";

export const metadata: Metadata = { title: "Download | Spare Room" };

function Cmd({ children, label }: { children: string; label: string }) {
  return (
    <pre tabIndex={0} aria-label={label}
      className="path mt-3 overflow-x-auto rounded-md bg-navy px-4 py-3 text-[14px] text-white">{children}</pre>
  );
}

/** One way in: a number, a short heading and the steps. */
function Way({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-x-4 border-t border-line pt-6 first:border-0 first:pt-0">
      <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-full bg-navy text-[16px] font-bold text-white">{n}</span>
      <div className="min-w-0">
        <h3 className="text-xl font-bold leading-9">{title}</h3>
        <div className="mt-2 space-y-3">{children}</div>
      </div>
    </li>
  );
}

export default function Download() {
  const size = fileSize(recorded.size_bytes);
  return (
    <>
      <PageHero title="Download" lead="Windows 10 or 11. One file, no installer." />

      <Band>
        <section aria-labelledby="judges-title"
          className="max-w-[860px] rounded-lg border-2 border-accent bg-accent-soft p-5 sm:p-8">
          <h2 id="judges-title" className="text-2xl font-extrabold tracking-tight sm:text-[30px]">For judges</h2>
          <p className="mt-1 text-muted">Start in the browser; nothing to download. The real tool is the second option.</p>

          <ol className="mt-6 space-y-6">
            <Way n={1} title="No download: try it in your browser">
              <p>The <Link href="/#try">playground on the home page</Link> runs the same sample stranger code in your
                account and in the spare room, on a fake laptop, using Spare Room&apos;s own rules. Add your own files and
                run it again. The <Link href="/#video">2-minute video</Link> shows a real run.</p>
            </Way>
            <Way n={2} title="Run the real tool (Windows)">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <a href={DOWNLOAD_URL} className="btn btn-navy">Download spareroom.exe</a>
                <span className="text-[15px] font-semibold">Version {recorded.tool_version}{size && <>, {size}</>}</span>
              </div>
              {recorded.sha256 && <p className="text-[15px]">SHA-256: <Path>{recorded.sha256}</Path></p>}
              <p className="text-[15px]"><a href={RELEASE_URL} className="inline-flex min-h-11 items-center">All files and checksums</a></p>
              <p>Then double-click <Path>spareroom.exe</Path>.</p>
              <ul className="list-disc space-y-2 pl-5 marker:text-accent-ink">
                <li>Your browser may say the file isn&apos;t commonly downloaded: choose <b>Keep</b>.</li>
                <li>Windows may then say &ldquo;Windows protected your PC&rdquo; because the file is unsigned: choose{" "}
                  <b>More info</b>, then <b>Run anyway</b>.</li>
              </ul>
              <p>It only scans a fake laptop bundled inside the file, needs no admin and uses no internet. It opens a
                report in your browser and waits for you to press Enter.</p>
            </Way>
            <Way n={3} title="Command line (Windows)">
              <p>In PowerShell, in the download folder, run:</p>
              <Cmd label="PowerShell command">{".\\spareroom.exe report --demo"}</Cmd>
            </Way>
            <Way n={4} title="Mac or Linux">
              <p>Run from source with Python 3.12 (standard library only):</p>
              <Cmd label="Terminal commands">{`git clone ${REPO_URL}\ncd spare-room\npython -m spareroom scan --demo`}</Cmd>
            </Way>
          </ol>
        </section>
      </Band>

      <Band tone="mist"><div className="max-w-[780px]">
        <SectionTitle>Check it before you run it</SectionTitle>
        <p>The exe is not code-signed, so Windows SmartScreen may warn you. Compare its checksum with the one above and
          in <a href={RELEASE_URL}>the release&apos;s SHA256SUMS.txt</a> first:</p>
        <Cmd label="PowerShell command">{"(Get-FileHash .\\spareroom.exe -Algorithm SHA256).Hash"}</Cmd>
        {recorded.sha256 && <p className="mt-3">It should print <Path>{recorded.sha256.toUpperCase()}</Path>.</p>}
        <p className="mt-3">If they match and you choose to run it, pick <b>More info</b>, then <b>Run anyway</b>.</p>
      </div></Band>

      <Band><div className="max-w-[780px]">
        <SectionTitle>On your own machine</SectionTitle>
        <p>These go beyond the demo. Run them from PowerShell in the download folder.</p>
        <Cmd label="All commands">{".\\spareroom.exe report          # what code running as you could reach\n.\\spareroom.exe setup           # create the spare room account (asks for admin)\n.\\spareroom.exe finish-setup    # run once inside the spare room\n.\\spareroom.exe verify          # inside the spare room: what it can still reach\n.\\spareroom.exe doctor          # inside the spare room: which coding tools are there\n.\\spareroom.exe --help          # everything else"}</Cmd>
      </div></Band>

      <Band tone="mist"><div className="max-w-[780px]">
        <SectionTitle>Limits</SectionTitle>
        <p>A separate Windows account is weaker than a virtual machine. Malware running with administrator rights, files
          every user can read, and your network or VPN can still be reached. Spare Room shows the files every account
          can read, so you can move them.</p>
      </div></Band>
    </>
  );
}
