import Link from "next/link";
import { HomeHero } from "@/components/Hero";
import PageRail from "@/components/PageRail";
import TwoRooms from "@/components/TwoRooms";
import { Band, Card, Path, SectionTitle } from "@/components/ui";
import { acct, BINANCE_URL, cellsFor, DOWNLOAD_URL, fileSize, recorded, RELEASE_URL } from "@/lib/data";
import { doctorRun, realVideo } from "@/lib/build-data";

/** Install advice with any winget command pulled out onto its own unbroken line. */
function InstallAdvice({ text }: { text: string }) {
  const m = text.match(/winget install [^,]*?--scope machine/);
  if (!m || m.index === undefined) return <span className="mt-1 block">{text}</span>;
  const before = text.slice(0, m.index).replace(/[:,]?\s*$/, "");
  const after = text.slice(m.index + m[0].length).replace(/^[\s,.]*(or\b)?/, (s, or) => (or ? "Or" : ""));
  return (
    <span className="mt-1 block">
      {before}:
      <code tabIndex={0}
        className="my-1.5 block overflow-x-auto whitespace-nowrap rounded border border-line bg-paper px-2 py-1 font-mono text-[13px]">
        {m[0]}
      </code>
      {after.trim() && <span className="block">{after.trim()}</span>}
    </span>
  );
}

const RAIL = [
  { id: "overview", label: "Overview" },
  { id: "video", label: "Demo video" },
  { id: "rooms", label: "Two rooms" },
  { id: "tools", label: "Your coding test" },
  { id: "gaps", label: "What gets through" },
  { id: "get", label: "Download" },
];

export default function Home() {
  const leaks = acct.verify.readable_env_outside_profiles;
  const video = realVideo();
  const doctor = doctorRun();
  const ready = doctor ? doctor.tools.filter((t) => t.found).length : 0;
  const yours = cellsFor("normal").filter((c) => c === "visible").length;
  const spare = cellsFor("interview").filter((c) => c === "visible").length;
  const rail = RAIL.filter((r) => (r.id === "video" ? !!video : r.id === "tools" ? !!doctor : true));

  return (
    <>
      <HomeHero stats={[
        { value: String(yours), label: "reachable from your account", mark: "reachable" },
        { value: String(spare), label: "from the spare room", mark: "blocked" },
        { value: `${acct.setup_wall_s} s`, label: "to set up", mark: "time" },
      ]} />
      <PageRail items={rail} />

      <Band id="overview" labelledBy="overview-title" rail>
        <h2 id="overview-title" className="sr-only">Overview</h2>
        <div className="max-w-[780px] space-y-5">
          <p className="text-[22px] font-bold leading-snug sm:text-[26px]">
            In Binance&apos;s account of its $6.34B loss, one step was an engineer downloading a recruiter&apos;s coding
            &ldquo;assignment&rdquo; onto his work computer.{" "}
            <a href={BINANCE_URL} rel="noreferrer">Read the report</a>
            <span className="text-[17px] font-normal text-muted"> (Binance&apos;s incident report, as reported by
              TheStreet on Yahoo Finance)</span>.
          </p>
          <p className="text-lg">
            Recruiters and clients often send a short coding test before the first call. When you open it, its code
            runs as you and reaches what you can: SSH keys, cloud logins, crypto wallets, saved browser passwords.
            Spare Room shows that reach, then gives the test a separate Windows account, the spare room, where those
            files are out of reach.
          </p>
        </div>
      </Band>

      {video && (
        <Band id="video" labelledBy="video-title" tone="dark" rail>
          <SectionTitle id="video-title">Watch it run on a real laptop</SectionTitle>
          <p className="mb-6 max-w-[680px] text-white/85">
            Two minutes, narrated and captioned, recorded from the tool itself on the test machine. The computer name
            and one project folder are covered.
          </p>
          <video controls preload="none" playsInline poster={video.poster ?? undefined}
            className="aspect-video h-auto w-full rounded-lg border border-white/15 bg-black shadow-[0_20px_60px_rgba(0,0,0,.45)]">
            <source src={video.src} type="video/mp4" />
            {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" />}
            Your browser cannot play this video.
          </video>
        </Band>
      )}

      <Band id="rooms" labelledBy="rooms-title" rail>
        <SectionTitle id="rooms-title">Two rooms</SectionTitle>
        <p className="mb-6 max-w-[720px]">
          Your room holds 13 fake secrets of the kinds attackers look for. The spare room is a separate Windows account
          with nothing in it. Each step replays what the real tool recorded.
        </p>
        <TwoRooms />
      </Band>

      {doctor && (
        <Band id="tools" labelledBy="tools-title" tone="mist" rail>
          <SectionTitle id="tools-title">Can I do my coding test in the spare room?</SectionTitle>
          <p className="mb-6 max-w-[720px]">
            Recorded inside the spare room on {doctor.ran_at.slice(0, 10)}: {ready} of {doctor.tools.length} coding
            tools were available there. Anything installed only in your own account is not, so install it for all users.
          </p>
          <div className="overflow-hidden rounded-lg border border-line bg-card">
            <table className="w-full table-fixed text-[15px]">
              <caption className="sr-only">Coding tools found inside the spare room</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-3 py-3 font-bold sm:px-5">Tool</th>
                  <th scope="col" className="px-3 py-3 font-bold sm:px-5">In the spare room</th>
                </tr>
              </thead>
              <tbody>
                {doctor.tools.map((t) => (
                  <tr key={t.name} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="w-36 px-3 py-3 text-left font-semibold sm:w-56 sm:px-5">{t.label}</th>
                    <td className="px-3 py-3 sm:px-5">
                      {t.found ? (
                        <span className="font-medium text-ok">Available{t.version ? `, ${t.version}` : ""}</span>
                      ) : (
                        <>
                          <span className="font-semibold text-high">Missing.</span>{" "}
                          {t.note && <span className="text-muted">{t.note} </span>}
                          <InstallAdvice text={t.install} />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Band>
      )}

      <Band id="gaps" labelledBy="gaps-title" rail>
        <SectionTitle id="gaps-title">What still gets through</SectionTitle>
        <div className="grid gap-5 md:grid-cols-2">
          <Card>
            <h3 className="text-xl font-bold">Files every account can read</h3>
            <p className="mt-2">
              {leaks.length > 0 ? (
                <>Checked from inside the spare room, this file outside any account folder was still readable:{" "}
                  {leaks.map((p) => <Path key={p}>{p}</Path>)}. A separate account cannot protect it; move it into your
                  own folder.</>
              ) : (
                <>Checked from inside the spare room, no such file was found.</>
              )}
            </p>
          </Card>
          <Card>
            <h3 className="text-xl font-bold">Anything a separate account cannot stop</h3>
            <p className="mt-2">
              It is weaker than a virtual machine: malware with administrator rights, and your network or VPN, can
              still be reached.
            </p>
          </Card>
        </div>
        <p className="mt-8">
          <Link href="/results/" className="inline-flex min-h-11 items-center text-lg font-semibold">See the full results</Link>
        </p>
      </Band>

      <Band id="get" labelledBy="get-title" tone="accent" rail>
        <SectionTitle id="get-title" className="[&>span]:bg-navy">Download Spare Room</SectionTitle>
        <div className="max-w-[760px] space-y-3">
          <p>
            For Windows 10 and 11. One file, no installer. Double-click it to start the safe demo: it scans only a fake
            laptop bundled inside the file, needs no administrator rights and uses no internet.
          </p>
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a href={DOWNLOAD_URL} className="btn btn-navy">Download spareroom.exe</a>
          <span className="text-[15px] font-semibold">
            Version {recorded.tool_version}{fileSize(recorded.size_bytes) && <>, {fileSize(recorded.size_bytes)}</>}
          </span>
        </div>
        {recorded.sha256 && <p className="mt-3 text-[15px]">SHA-256: <Path>{recorded.sha256}</Path></p>}
        <p className="mt-2 text-[15px]">
          <a href={RELEASE_URL} className="inline-flex min-h-11 items-center">All files and checksums</a>
          <span aria-hidden> &middot; </span>
          <Link href="/download/" className="inline-flex min-h-11 items-center">How to run it</Link>
        </p>
      </Band>
    </>
  );
}
