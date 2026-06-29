// Auto-tests: per-project workspace-trust store (Help004). Zero deps; temp QWEN_HARNESS_DIR — no model.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readTrustDecision, storeTrustDecision, isWorkspaceTrusted } from "../src/permissions/workspaceTrust.ts";
import { projectDir } from "../src/state/session.ts";

let tmp = "";
let cwd = "";
const saved = process.env.QWEN_HARNESS_DIR;

before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "qh-trust-"));
  process.env.QWEN_HARNESS_DIR = tmp;
  cwd = path.join(tmp, "proj");
});

after(async () => {
  if (saved === undefined) delete process.env.QWEN_HARNESS_DIR;
  else process.env.QWEN_HARNESS_DIR = saved;
  if (tmp) await fs.rm(tmp, { recursive: true, force: true });
});

test("no decision on record → null / not trusted (fail-safe)", () => {
  assert.equal(readTrustDecision(cwd), null);
  assert.equal(isWorkspaceTrusted(cwd), false);
});

test("storeTrustDecision round-trips true and false", () => {
  assert.equal(storeTrustDecision(cwd, true), true);
  assert.equal(readTrustDecision(cwd), true);
  assert.equal(isWorkspaceTrusted(cwd), true);
  assert.equal(storeTrustDecision(cwd, false), true);
  assert.equal(readTrustDecision(cwd), false);
  assert.equal(isWorkspaceTrusted(cwd), false); // an explicit "false" is NOT trusted
});

test("persists version + trusted + decidedAt and leaves no temp file (atomic write)", async () => {
  storeTrustDecision(cwd, true);
  const dir = projectDir(cwd);
  const raw = JSON.parse(await fs.readFile(path.join(dir, "trust.json"), "utf8"));
  assert.equal(raw.version, 1);
  assert.equal(raw.trusted, true);
  assert.equal(typeof raw.decidedAt, "string");
  await assert.rejects(fs.stat(path.join(dir, "trust.json.tmp"))); // temp file must not linger
});

test("trust is PER-PROJECT (a decision in A doesn't apply in B)", () => {
  const projA = path.join(tmp, "alpha");
  const projB = path.join(tmp, "beta");
  storeTrustDecision(projA, true);
  assert.equal(isWorkspaceTrusted(projA), true);
  assert.equal(readTrustDecision(projB), null); // isolated — no carry-over
});

test("malformed / non-boolean trust.json → null (fail-safe)", async () => {
  const dir = projectDir(cwd);
  await fs.writeFile(path.join(dir, "trust.json"), "{ not json");
  assert.equal(readTrustDecision(cwd), null);
  await fs.writeFile(path.join(dir, "trust.json"), JSON.stringify({ version: 1, trusted: "yes" }));
  assert.equal(readTrustDecision(cwd), null); // non-boolean → no decision
});

test("storeTrustDecision: returns false and leaves no temp file when the rename fails", async () => {
  const proj = path.join(tmp, "rofs"); // a fresh project so it doesn't collide with the others
  const dir = projectDir(proj);
  await fs.mkdir(path.join(dir, "trust.json")); // destination is a DIRECTORY → renameSync(tmp -> trust.json) throws
  assert.equal(storeTrustDecision(proj, true), false);
  await assert.rejects(fs.stat(path.join(dir, "trust.json.tmp"))); // the half-written temp file was cleaned up
});
