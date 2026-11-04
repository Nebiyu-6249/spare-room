import Link from "next/link";
import TwoRooms from "@/components/TwoRooms";
import { Card, Path, RecordedNote, SectionTitle } from "@/components/ui";
import { acct, BINANCE_URL } from "@/lib/data";

export default function Home() {
  const leaks = acct.verify.readable_env_outside_profiles;
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

      <section aria-labelledby="video-title">
        <SectionTitle id="video-title">The demo in 3 minutes</SectionTitle>
        <video controls preload="none" playsInline poster="/video/poster.jpg" width={1280} height={720}
          className="h-auto w-full rounded-md border border-line bg-card">
          <source src="/video/spare-room-walkthrough.mp4" type="video/mp4" />
          <track kind="captions" src="/video/spare-room-walkthrough.vtt" srcLang="en" label="English" />
          Your browser cannot play this video. It shows the site and its recorded results with on-screen captions.
        </video>
        <p className="mt-2 text-sm text-muted">No sound; the captions are on screen. Recorded from an earlier layout of this site.</p>
      </section>

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

      <p className="mt-12">
        <Link href="/results/" className="inline-flex min-h-11 items-center text-lg font-medium">
          See the full results
        </Link>
      </p>
    </div>
  );
}
