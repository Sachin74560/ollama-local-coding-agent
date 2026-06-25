// Auto-tests: REPL helpers. Zero deps, pure logic, no model/readline.

import { test } from "node:test";
import assert from "node:assert/strict";
import { interruptAction, shellGuidance, parseAskReply } from "../src/cli/repl.ts";

test("interruptAction: cancel while a task runs, exit when idle", () => {
  assert.equal(interruptAction(true), "cancel");
  assert.equal(interruptAction(false), "exit");
});

test("shellGuidance: powershell on Windows, bash elsewhere", () => {
  assert.match(shellGuidance("win32"), /powershell/i);
  assert.match(shellGuidance("win32"), /Get-Process/);
  assert.match(shellGuidance("linux"), /bash/i);
  assert.match(shellGuidance("darwin"), /bash/i);
});

test("parseAskReply: y/yes → once, a/always → always, else → no", () => {
  assert.equal(parseAskReply("y"), "once");
  assert.equal(parseAskReply("yes"), "once");
  assert.equal(parseAskReply("a"), "always");
  assert.equal(parseAskReply("ALWAYS"), "always");
  assert.equal(parseAskReply("n"), "no");
  assert.equal(parseAskReply(""), "no");
  assert.equal(parseAskReply("nonsense"), "no");
});
