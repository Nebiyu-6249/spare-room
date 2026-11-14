import type { Metadata } from "next";
import { PageHero } from "@/components/Hero";
import { Band, Card, Path, SectionTitle } from "@/components/ui";
import { recorded, RELEASE_URL, REPO_URL } from "@/lib/data";

export const metadata: Metadata = { title: "Download | Spare Room" };

function Cmd({ children }: { children: string }) {
  return (
    <pre tabIndex={0} className="path mt-3 overflow-x-auto rounded-md bg-navy px-4 py-3 text-[14px] text-white">{children}</pre>
  );
}

export default function Download() {
  return (
    <>
      <PageHero title="Download" lead="Windows 10 or 11. One file, no installer." />

      <Band><div className="max-w-[780px]">
      <Card>
        <a href={RELEASE_URL} className="btn btn-accent">Download spareroom.exe from GitHub Releases</a>
        <p className="mt-4 text-[15px] text-muted">Version {recorded.tool_version}. The release also lists SHA256SUMS.txt.</p>
        {recorded.sha256 && (
          <p className="mt-2 text-[15px]">SHA-256: <Path>{recorded.sha256}</Path></p>
        )}
      </Card>

      <SectionTitle>Check it before you run it</SectionTitle>
      <p>The exe is not code-signed, so Windows SmartScreen may warn you. Compare its checksum with the one in the release first:</p>
      <Cmd>{"Get-FileHash .\\spareroom.exe -Algorithm SHA256"}</Cmd>
      <p className="mt-3">If they match and you choose to run it, pick <span className="font-medium">More info</span>, then{" "}
        <span className="font-medium">Run anyway</span>.</p>

      </div></Band>

      <Band tone="mist"><div className="max-w-[780px]">
      <SectionTitle>Try the safe demo mode first</SectionTitle>
      <p>Demo mode needs no administrator rights and touches only the fake laptop bundled inside the exe.</p>
      <Cmd>{"spareroom.exe scan --demo\nspareroom.exe report --demo"}</Cmd>

      </div></Band>

      <Band tone="white"><div className="max-w-[780px]">
      <SectionTitle>Then on your own machine</SectionTitle>
      <Cmd>{"spareroom.exe report          # what code running as you could reach\nspareroom.exe setup           # create the spare room account (asks for admin)\nspareroom.exe finish-setup    # run once inside the spare room\nspareroom.exe verify          # inside the spare room: what it can still reach\nspareroom.exe doctor          # inside the spare room: which coding tools are there"}</Cmd>

      </div></Band>

      <Band tone="mist"><div className="max-w-[780px]">
      <SectionTitle>Or run from source</SectionTitle>
      <p>Python 3.12, standard library only.</p>
      <Cmd>{`git clone ${REPO_URL}\ncd spare-room\npython -m spareroom scan --demo`}</Cmd>
      </div></Band>
    </>
  );
}
