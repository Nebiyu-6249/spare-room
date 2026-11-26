// The playground must agree with the real tool's recorded output.
// Run: npm test (node --test, TypeScript types stripped by Node itself).
import { test } from "node:test";
import assert from "node:assert/strict";
import rulesJson from "../data/rules.json" with { type: "json" };
import twin from "../data/twin_run.json" with { type: "json" };
import account from "../data/account.json" with { type: "json" };
import scanDemo from "../data/scan_demo.json" with { type: "json" };
import {
  buildPath, classify, cleanEnvNames, defaultItems, runProbe, variants,
  type Item, type Match, type Rules,
} from "../lib/playground.ts";

const rules = rulesJson as unknown as Rules;
const findings = scanDemo.findings as unknown as (Match & { path: string })[];
const shared = account.verify.readable_env_outside_profiles;
const items = defaultItems(rules, {}, findings, shared);
/** The recorded probe prints <fake_laptop>\C\Users\testdev\...; the playground shows C:\Users\testdev\... */
const fromRecorded = (p: string) => p.replace(/^<fake_laptop>\\C\\/, "C:\\");
const paths = (lines: { item: Item }[]) => lines.map((l) => l.item.path);

test("default fake laptop: your account matches the recorded run (13 of 13 visible)", () => {
  const yours = runProbe(rules, items, "yours");
  assert.equal(yours.inProfile.total, 13);
  assert.equal(yours.inProfile.visible, twin.normal.visible.length);
  const inProfile = yours.visible.filter((l) => l.item.origin === "fake_laptop");
  assert.deepEqual(paths(inProfile), twin.normal.visible.map(fromRecorded));
  assert.deepEqual(yours.blocked, []);
  assert.deepEqual(yours.notLooked, []);
  assert.deepEqual(yours.unknown, []);
});

test("default fake laptop: the spare room matches the recorded run (0 visible, 13 blocked) plus verify's .env", () => {
  const spare = runProbe(rules, items, "spare");
  assert.equal(spare.inProfile.visible, twin.interview.visible.length);
  assert.equal(spare.inProfile.visible, 0);
  assert.deepEqual(paths(spare.blocked), twin.interview.blocked.map(fromRecorded));
  // verify, run inside the spare room: readable by every account.
  assert.deepEqual(paths(spare.shared), shared);
  assert.deepEqual(paths(spare.visible), shared);
  assert.equal(account.verify.normal_profile_readable, 0);
});

test("the rules alone classify the 13 as the recorded scan did (category and severity)", () => {
  for (const it of items.filter((i) => i.origin === "fake_laptop")) {
    const c = classify(rules, it.path, it.path.endsWith(".npmrc") ? ["//registry.npmjs.org/:_authToken"] : []);
    assert.ok(c.found, it.path);
    assert.equal(c.match.category, it.match!.category, it.path);
    assert.equal(c.match.severity, it.match!.severity, it.path);
  }
});

test("a .env added to C:\\dev is reachable from both rooms and listed as readable by every account", () => {
  const p = buildPath(rules, { type: "env", where: "c_dev", fileName: ".env", project: "client-api" });
  assert.equal(p, "C:\\dev\\client-api\\.env");
  const added: Item = { id: "a", path: p, origin: "added", envNames: ["STRIPE_SECRET_KEY"] };
  for (const room of ["yours", "spare"] as const) {
    const rep = runProbe(rules, [...items, added], room);
    assert.ok(paths(rep.visible).includes(p), room);
    assert.ok(paths(rep.shared).includes(p), room);
  }
});

test("a .env added to your Desktop is blocked in the spare room", () => {
  const p = buildPath(rules, { type: "env", where: "desktop", fileName: ".env", project: "" });
  const added: Item = { id: "a", path: p, origin: "added" };
  assert.ok(paths(runProbe(rules, [added], "yours").visible).includes(p));
  assert.ok(paths(runProbe(rules, [added], "spare").blocked).includes(p));
});

test("Public and other drives are not recorded cases: unknown, never guessed", () => {
  for (const where of ["public", "d_work"] as const) {
    const p = buildPath(rules, { type: "env", where, fileName: ".env", project: "x" });
    const rep = runProbe(rules, [{ id: "a", path: p, origin: "added" }], "spare");
    assert.deepEqual(paths(rep.unknown), [p]);
    assert.equal(rep.visible.length + rep.blocked.length, 0);
  }
});

test("names the rules do not know are reported as not looked for", () => {
  for (const name of ["notes.txt", ".env.test", "secrets.json"]) {
    const p = buildPath(rules, { type: "any", where: "desktop", fileName: name, project: "" });
    const rep = runProbe(rules, [{ id: "a", path: p, origin: "added" }], "yours");
    assert.equal(rep.notLooked.length, 1, name);
    assert.equal(rep.checked, 0);
  }
  // node_modules is skipped by the real .env hunt.
  const nm = buildPath(rules, { type: "env", where: "project", fileName: ".env", project: "node_modules" });
  assert.equal(classify(rules, nm).found, false);
});

test("an SSH key in its usual place is recognised; on the Desktop it is not looked for", () => {
  const [rsa] = variants(rules, "ssh");
  const usual = buildPath(rules, { type: "ssh", where: "usual", variant: rsa, fileName: "", project: "" });
  assert.equal(usual, "C:\\Users\\testdev\\.ssh\\id_rsa");
  assert.equal(classify(rules, usual).found, true);
  const desk = buildPath(rules, { type: "ssh", where: "desktop", variant: rsa, fileName: "", project: "" });
  const c = classify(rules, desk);
  assert.equal(c.found, false);
  assert.match(c.found ? "" : c.hint ?? "", /only at C:\\Users\\testdev\\.ssh\\id_rsa/);
});

test(".env variable names are kept, values are dropped", () => {
  const { names, droppedValues } = cleanEnvNames("STRIPE_SECRET_KEY=FAKE-DEMO-value, DATABASE_URL\nAWS_SECRET_ACCESS_KEY");
  assert.deepEqual(names, ["STRIPE_SECRET_KEY", "DATABASE_URL", "AWS_SECRET_ACCESS_KEY"]);
  assert.equal(droppedValues, true);
  assert.ok(!names.join(" ").includes("FAKE-DEMO"));
});
