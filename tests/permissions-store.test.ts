// Auto-tests: persisted "always allow" rule store. Zero deps; uses a temp QWEN_HARNESS_DIR — no model.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadPermissionRules, rememberAllowRule } from "../src/permissions/permissionsStore.ts";

let tmp = "";
const saved = process.env.QWEN_HARNESS_DIR;

before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "qh-perms-"));
  process.env.QWEN_HARNESS_DIR = tmp;
});

after(async () => {
  if (saved === undefined) delete process.env.QWEN_HARNESS_DIR;
  else process.env.QWEN_HARNESS_DIR = saved;
  if (tmp) await fs.rm(tmp, { recursive: true, force: true });
});

test("store: empty when no file exists", () => {
  assert.deepEqual(loadPermissionRules(), []);
});

test("store: rememberAllowRule persists + loadPermissionRules round-trips (deduped)", () => {
  assert.equal(rememberAllowRule("bash", "npm test"), true);
  assert.equal(rememberAllowRule("powershell", "Get-Process"), true);
  assert.equal(rememberAllowRule("bash", "npm test"), true); // dedupe — no second entry
  const rules = loadPermissionRules();
  assert.equal(rules.length, 2);
  assert.ok(rules.every((r) => r.decision === "allow" && typeof r.commandPrefix === "string"));
  assert.ok(rules.some((r) => r.tool === "bash" && r.commandPrefix === "npm test"));
  assert.ok(rules.some((r) => r.tool === "powershell" && r.commandPrefix === "Get-Process"));
});
