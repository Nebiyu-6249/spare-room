import Link from "next/link";
import TwoRooms from "@/components/TwoRooms";
import { Card, Path, RecordedNote, SectionTitle } from "@/components/ui";
import { acct, BINANCE_URL } from "@/lib/data";
import { doctorRun, realVideo } from "@/lib/build-data";

export default function Home() {
  const leaks = acct.verify.readable_env_outside_profiles;
  const video = realVideo();
  const doctor = doctorRun();
  const ready = doctor ? doctor.tools.filter((t) => t.found).length : 0;

  return (
    <div>
      <section className="max-w-3xl space-y-5">
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
          Run the recruiter&apos;s code in a room with nothing in it.
        </h1>
        <p className="text-lg sm:text-xl">
          Spare Room shows what code from a recruiter or client could reach on your Windows laptop, then sets up a
          separate account, the spare room, where it reaches nothing that matters.
        </p>
        <p className="text-base">
          In Binance&apos;s account of its $6.34B loss, one step was an engineer downloading a recruiter&apos;s coding
          &quot;assignment&quot; onto his work computer.{" "}
          <a href={BINANCE_URL} rel="noreferrer">Read the report</a>.
        </p>
        <RecordedNote />
      </section>

      {video && (
        <section aria-labelledby="video-title">
          <SectionTitle id="video-title">See the tool run</SectionTitle>
          <video controls preload="metadata" playsInline className="h-auto w-full rounded-md border border-line bg-card">
            <source src={video.src} type="video/mp4" />
            {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" />}
            Your browser cannot play this video.
          </video>
        </section>
      )}

      <section aria-labelledby="rooms-title">
        <SectionTitle id="rooms-title">Two rooms</SectionTitle>
        <p className="mb-6 max-w-3xl">
          Your room holds 13 fake secrets of the kinds attackers look for. The spare room is a separate Windows account
          with nothing in it. Each step replays what the real tool recorded.
        </p>
        <TwoRooms />
      </section>

      <section aria-labelledby="gaps-title">
        <SectionTitle id="gaps-title">What still gets through</SectionTitle>
        <Card>
          <ul className="space-y-4">
            <li>
              <span className="font-medium">Files every account can read.</span>{" "}
              {leaks.length > 0 ? (
                <>Checked from inside the spare room, this file outside any account folder was still readable:{" "}
                  {leaks.map((p) => <Path key={p}>{p}</Path>)}. A separate account cannot protect it; move it into your
                  own folder.</>
              ) : (
                <>Checked from inside the spare room, no such file was found.</>
              )}
            </li>
            <li>
              <span className="font-medium">Anything a separate account cannot stop.</span> It is weaker than a virtual
              machine: malware with administrator rights, and your network or VPN, can still be reached.
            </li>
          </ul>
        </Card>
      </section>

      {doctor && (
        <section aria-labelledby="tools-title">
          <SectionTitle id="tools-title">Can I do my coding test in the spare room?</SectionTitle>
          <p className="mb-4 max-w-3xl">
            Recorded inside the spare room on {doctor.ran_at.slice(0, 10)}: {ready} of {doctor.tools.length} coding
            tools were available there. Anything installed only in your own account is not, so install it for all users.
          </p>
          <div className="rounded-md border border-line bg-card">
            <table className="w-full text-[15px]">
              <caption className="sr-only">Coding tools found inside the spare room</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">Tool</th>
                  <th scope="col" className="px-3 py-2.5 font-medium sm:px-4">In the spare room</th>
                </tr>
              </thead>
              <tbody>
                {doctor.tools.map((t) => (
                  <tr key={t.name} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="w-36 px-3 py-2.5 text-left font-medium sm:w-56 sm:px-4">{t.label}</th>
                    <td className="px-3 py-2.5 sm:px-4">
                      {t.found ? (
                        <span className="text-ok">Available{t.version ? `, ${t.version}` : ""}</span>
                      ) : (
                        <>
                          <span className="font-medium text-high">Missing.</span>{" "}
                          {t.note && <span className="text-muted">{t.note} </span>}
                          <span className="mt-1 block">{t.install}</span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section aria-labelledby="download-title">
        <SectionTitle id="download-title">Download</SectionTitle>
        <p className="max-w-3xl">
          One Windows file, no installer. Start with the safe demo mode, which touches only a fake laptop bundled
          inside it.
        </p>
        <p className="mt-2">
          <Link href="/download/" className="inline-flex min-h-11 items-center font-medium">Download Spare Room</Link>
        </p>
      </section>

      <p className="mt-10">
        <Link href="/results/" className="inline-flex min-h-11 items-center text-lg font-medium">
          See the full results
        </Link>
      </p>
    </div>
  );
}
