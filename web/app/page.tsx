import Link from "next/link";
import { BigNumber, Card, RecordedNote, SeverityTag } from "@/components/ui";
import { acct, APP_NAME, CATEGORY_LABELS, countBy, scan, twin } from "@/lib/data";

export default function Home() {
  const normal = twin.normal.visible.length;
  const interview = twin.interview.visible.length;
  const total = twin.matrix.secrets.length;
  const bySev = countBy(scan.findings, (f) => f.severity);
  const byCat = countBy(scan.findings, (f) => f.category);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{APP_NAME}</h1>
        <p className="max-w-2xl text-lg">
          A Windows tool for developers about to run code from a recruiter or client. It lists what that code
          could reach on your laptop today, creates a separate standard account for running it, and checks the
          difference between the two.
        </p>
        <RecordedNote />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <BigNumber value={`${normal} of ${total}`} label="fake secrets reachable from the normal account" tone="high" />
        </Card>
        <Card>
          <BigNumber value={`${interview} of ${total}`} label="reachable from the interview account" tone="ok" />
        </Card>
        <Card>
          <BigNumber value={`${acct.setup_wall_s} s`} label="to create the interview account" />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">The scan of the bundled fake laptop</h2>
        <Card>
          <p>
            <span className="text-2xl font-semibold tabular-nums">{scan.findings.length}</span> things code running
            as you could reach, found in {scan.locations_checked} places checked.
          </p>
          <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            <span className="inline-flex items-center gap-2"><SeverityTag level="high" /> {bySev.high ?? 0}</span>
            <span className="inline-flex items-center gap-2"><SeverityTag level="medium" /> {bySev.medium ?? 0}</span>
            <span className="inline-flex items-center gap-2"><SeverityTag level="info" /> {bySev.info ?? 0}</span>
          </p>
          <ul className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
              <li key={k} className="flex justify-between border-b border-line py-1">
                <span>{label}</span>
                <span className="tabular-nums text-muted">{byCat[k] ?? 0}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Link href="/results/" className="rounded-md border border-line bg-card p-5 no-underline hover:border-accent">
          <span className="block font-medium text-ink">Results</span>
          <span className="text-sm text-muted">Both accounts side by side, setup time, coverage of public reports.</span>
        </Link>
        <Link href="/privacy/" className="rounded-md border border-line bg-card p-5 no-underline hover:border-accent">
          <span className="block font-medium text-ink">Privacy</span>
          <span className="text-sm text-muted">Exactly what the tool reads, and what it never does.</span>
        </Link>
        <Link href="/download/" className="rounded-md border border-line bg-card p-5 no-underline hover:border-accent">
          <span className="block font-medium text-ink">Download</span>
          <span className="text-sm text-muted">The Windows exe, its checksum, and how to try the safe demo mode.</span>
        </Link>
      </section>
    </div>
  );
}
