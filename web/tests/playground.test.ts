// The playground must agree with the real tool's recorded output.
// Run: npm test (node --test, TypeScript types stripped by Node itself).
import { test } from "node:test";
import assert from "node:assert/strict";
import rulesJson from "../data/rules.json" with { type: "json" };
import twin from "../data/twin_run.json" with { type: "json" };
import account from "../data/account.json" with { type: "json" };
import scanDemo from "../data/scan_demo.json" with { type: "json" };
import {
  buildPath, classify, cleanEnvNames, defaultItems, runProbe, variants, verifyFindings,
  type Item, type Match, type Rules,
} from "../lib/playground.ts";

const rules = rulesJson as unknown as Rules;
const findings = scanDemo.findings as unknown as (Match & { path: string })[];
const items = defaultItems(rules, {}, findings);
/** The recorded probe prints <fake_laptop>\C\Users\testdev\...; the playground shows C:\Users\testdev\... */
const fromRecorded = (p: string) => p.replace(/^<fake_laptop>\\C\\/, "C:\\");
const paths = (lines: { item: Item }[]) => lines.map((l) => l.item.path);
const add = (o: Parameters<typeof buildPath>[1]): Item => ({ id: o.fileName || "x", path: buildPath(rules, o), origin: "added" });

test("default fake laptop: exactly the 13 recorded fake secrets", () => {
  assert.equal(items.length, 13);
  assert.deepEqual(items.map((i) => i.path), twin.normal.visible.map(fromRecorded));
});

test("default run in your account is exactly the recorded output: visible 13, blocked 0", () => {
  const yours = runProbe(rules, items, "yours");
  assert.deepEqual(paths(yours.visible), twin.normal.visible.map(fromRecorded));
  assert.deepEqual(paths(yours.blocked), twin.normal.blocked.map(fromRecorded));
  assert.equal(yours.visible.length, 13);
  assert.equal(yours.blocked.length, 0);
  assert.deepEqual([yours.unknown, yours.notLooked, yours.unlisted, yours.shared], [[], [], [], []]);
});

test("default run in the spare room is exactly the recorded output: visible 0, blocked 13", () => {
  const spare = runProbe(rules, items, "spare");
  assert.deepEqual(paths(spare.visible), twin.interview.visible.map(fromRecorded));
  assert.deepEqual(paths(spare.blocked), twin.interview.blocked.map(fromRecorded));
  assert.equal(spare.visible.length, 0);
  assert.equal(spare.blocked.length, 13);
});

test("verify's separate finding is the recorded readable-by-every-account .env", () => {
  const v = verifyFindings(rules, account.verify.readable_env_outside_profiles);
  assert.deepEqual(paths(v), account.verify.readable_env_outside_profiles);
  assert.equal(v.length, 1);
  assert.equal(v[0].match.category, "env_file");
  assert.equal(account.verify.normal_profile_readable, 0);
});

test("the rules alone classify the 13 as the recorded scan did (category and severity)", () => {
  for (const it of items) {
    const c = classify(rules, it.path, it.path.endsWith(".npmrc") ? ["//registry.npmjs.org/:_authToken"] : []);
    assert.ok(c.found, it.path);
    assert.equal(c.match.category, it.match!.category, it.path);
    assert.equal(c.match.severity, it.match!.severity, it.path);
  }
});

test("a .env added to C:\\dev counts in both rooms and is readable by every account", () => {
  const env = add({ type: "env", where: "c_dev", fileName: ".env", project: "take-home" });
  assert.equal(env.path, "C:\\dev\\take-home\\.env");
  for (const room of ["yours", "spare"] as const) {
    const rep = runProbe(rules, [...items, env], room);
    assert.ok(paths(rep.visible).includes(env.path), room);
    assert.ok(paths(rep.shared).includes(env.path), room);
  }
  assert.equal(runProbe(rules, [...items, env], "spare").visible.length, 1);
  assert.equal(runProbe(rules, [...items, env], "yours").visible.length, 14);
});

test("a .env added to your Desktop is blocked in the spare room", () => {
  const env = add({ type: "env", where: "desktop", fileName: ".env", project: "" });
  assert.ok(paths(runProbe(rules, [env], "yours").visible).includes(env.path));
  assert.ok(paths(runProbe(rules, [env], "spare").blocked).includes(env.path));
});

test("files in your folder that the scan does not list: readable from your account, blocked from the spare room", () => {
  const pw = add({ type: "any", where: "documents", fileName: "passwords.txt", project: "" });
  const [, ed] = variants(rules, "ssh");
  const key = add({ type: "ssh", where: "desktop", variant: ed, fileName: "", project: "" });
  assert.equal(pw.path, "C:\\Users\\testdev\\Documents\\passwords.txt");
  assert.equal(key.path, "C:\\Users\\testdev\\Desktop\\id_ed25519");
  const yours = runProbe(rules, [...items, pw, key], "yours");
  const spare = runProbe(rules, [...items, pw, key], "spare");
  assert.deepEqual(yours.unlisted.map((u) => [u.item.path, u.reach]), [[pw.path, "visible"], [key.path, "visible"]]);
  assert.deepEqual(spare.unlisted.map((u) => [u.item.path, u.reach]), [[pw.path, "blocked"], [key.path, "blocked"]]);
  // Not part of the probe's list: the recorded counts are unchanged.
  assert.equal(yours.visible.length, 13);
  assert.equal(spare.blocked.length, 13);
  assert.match(spare.unlisted[1].hint ?? "", /only at C:\\Users\\testdev\\.ssh\\id_ed25519/);
});

test("unknown names outside your folder stay 'not looked for'; node_modules is skipped", () => {
  const notes = add({ type: "any", where: "c_dev", fileName: "notes.txt", project: "x" });
  const rep = runProbe(rules, [notes], "spare");
  assert.deepEqual(rep.notLooked.map((n) => n.item.path), [notes.path]);
  assert.equal(rep.unlisted.length, 0);
  const nm = buildPath(rules, { type: "env", where: "project", fileName: ".env", project: "node_modules" });
  assert.equal(classify(rules, nm).found, false);
});

test("Public and other drives are not recorded cases: unknown, never guessed", () => {
  for (const where of ["public", "d_work"] as const) {
    const env = add({ type: "env", where, fileName: ".env", project: "x" });
    const rep = runProbe(rules, [env], "spare");
    assert.deepEqual(paths(rep.unknown), [env.path]);
    assert.equal(rep.visible.length + rep.blocked.length, 0);
  }
});

test("an SSH key in its usual place is recognised", () => {
  const [rsa] = variants(rules, "ssh");
  const usual = buildPath(rules, { type: "ssh", where: "usual", variant: rsa, fileName: "", project: "" });
  assert.equal(usual, "C:\\Users\\testdev\\.ssh\\id_rsa");
  assert.equal(classify(rules, usual).found, true);
});

test("an empty file name adds no default name", () => {
  assert.equal(buildPath(rules, { type: "any", where: "desktop", fileName: "  ", project: "" }), "C:\\Users\\testdev\\Desktop\\");
});

test(".env variable names: values never kept", () => {
  assert.deepEqual(cleanEnvNames("PASSWORD = hunter2").names, ["PASSWORD"]);
  assert.deepEqual(cleanEnvNames("AWS_SECRET_ACCESS_KEY=abc def").names, ["AWS_SECRET_ACCESS_KEY"]);
  const r = cleanEnvNames("STRIPE_SECRET_KEY=FAKE-DEMO-value, DATABASE_URL\nAPI_TOKEN;bad name;=orphan");
  assert.deepEqual(r.names, ["STRIPE_SECRET_KEY", "DATABASE_URL", "API_TOKEN"]);
  assert.equal(r.droppedValues, true);
  assert.equal(r.droppedEntries, true);
  for (const leak of ["hunter2", "abc", "def", "FAKE-DEMO", "bad", "orphan"]) {
    assert.ok(!cleanEnvNames(`PASSWORD = hunter2, KEY=abc def, S=FAKE-DEMO-value, bad name, =orphan`).names
      .some((n) => n.includes(leak)), leak);
  }
});
