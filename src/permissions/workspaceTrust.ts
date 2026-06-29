// Workspace trust (Help004) — best-effort.
//
// The ONLY untrusted in-repo content the harness loads is the project-rules file (.qwen-harness.md / AGENTS.md /
// .qwenrules) that gets injected into the system prompt. Approvals / memory / sessions already live under the user
// dir (per-project), never the repo, so a clone can't ship them — they need no trust gate. This stores ONE
// per-project trust decision at <harnessDir>/projects/<projectKey>/trust.json (same scoping as permissions.json),
// so opening a cloned repo prompts before its project-rules can steer the model. Fail-safe: anything
// missing / unreadable / malformed → untrusted.

import fs from "node:fs";
import path from "node:path";
import { projectDir } from "../state/session.ts";

const TRUST_VERSION = 1; // bump + migrate in readTrustDecision() if the on-disk shape ever changes

function trustPath(cwd: string): string {
  return path.join(projectDir(cwd), "trust.json");
}

/** This project's stored trust decision, or null if none / unreadable / malformed (fail-safe). */
export function readTrustDecision(cwd: string): boolean | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(trustPath(cwd), "utf8")) as { trusted?: unknown };
    return typeof parsed.trusted === "boolean" ? parsed.trusted : null;
  } catch {
    return null; // no file / unreadable / malformed → no decision on record
  }
}

/** Persist this project's trust decision atomically (temp + rename). Returns false on write failure. */
export function storeTrustDecision(cwd: string, trusted: boolean): boolean {
  let tmp = "";
  try {
    const file = trustPath(cwd);
    tmp = `${file}.tmp`;
    const payload = { version: TRUST_VERSION, trusted, decidedAt: new Date().toISOString() };
    fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmp, file);
    return true;
  } catch {
    if (tmp) {
      try {
        fs.unlinkSync(tmp); // don't leave a half-written temp file behind on failure
      } catch {
        /* nothing to clean up */
      }
    }
    return false;
  }
}

/** True only when this project has an explicit "trusted" decision on record. */
export function isWorkspaceTrusted(cwd: string): boolean {
  return readTrustDecision(cwd) === true;
}
