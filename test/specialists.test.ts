import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPiArgs,
  dispatchPrompt,
  isSpecialist,
  plannerFollowUpError,
  roles,
} from "../src/specialists.ts";

const session = {
  sessionDir: "sessions",
  sessionId: "session-id",
  name: "pln-auth",
  reportProtocol: "roles/protocol.md",
};

test("Planner launches on Astra medium with complete isolation", () => {
  assert.equal(roles.planner.model, "openai-codex/gpt-6-astra");
  assert.equal(roles.planner.thinking, "medium");

  const args = buildPiArgs("planner", session);
  assert.deepEqual(
    args.slice(args.indexOf("--model"), args.indexOf("--model") + 4),
    ["--model", "openai-codex/gpt-6-astra", "--thinking", "medium"],
  );
  assert.ok(args.includes("--no-tools"));
  assert.ok(args.includes("--no-skills"));
  assert.ok(args.includes("--no-context-files"));
  assert.ok(!args.includes("--approve"));
  assert.ok(!args.includes("--tools"));
  assert.equal(
    args.filter((arg) => arg === "--append-system-prompt").length,
    2,
  );
  assert.ok(args.includes(roles.planner.prompt));
  assert.ok(args.includes(session.reportProtocol));
});

test("existing role launch authority remains unchanged", () => {
  const probe = buildPiArgs("probe", { ...session, name: "pb-auth" });
  const engineer = buildPiArgs("engineer", { ...session, name: "eng-auth" });
  const inspector = buildPiArgs("inspector", {
    ...session,
    name: "ins-auth",
  });

  for (const args of [probe, engineer, inspector])
    assert.ok(args.includes("--approve"));
  for (const args of [probe, inspector])
    assert.deepEqual(
      args.slice(args.indexOf("--tools"), args.indexOf("--tools") + 2),
      ["--tools", "read,grep,find,ls,bash"],
    );
});

test("Planner dispatch requires a nonblank evidence packet", () => {
  assert.throws(
    () => dispatchPrompt("planner", "Plan it", undefined),
    /context.*required/i,
  );
  assert.throws(
    () => dispatchPrompt("planner", "Plan it", "  \n"),
    /context.*required/i,
  );
  assert.equal(
    dispatchPrompt(
      "planner",
      "Plan it",
      "Observed behavior and relevant code.",
    ),
    "Task:\nPlan it\n\nEvidence packet:\nObserved behavior and relevant code.",
  );
  assert.equal(
    dispatchPrompt("engineer", "Build it", undefined),
    "Task:\nBuild it",
  );
});

test("Planner tabs are recognized as specialists", () => {
  for (const label of ["pb-auth", "eng-auth", "ins-auth", "pln-auth"])
    assert.equal(isSpecialist(label), true);
  assert.equal(isSpecialist("fd"), false);
});

test("Planner follow-ups are rejected with fresh-dispatch guidance", () => {
  assert.match(
    plannerFollowUpError("pln-auth") || "",
    /launch a fresh Planner with a complete (?:context|evidence) packet/i,
  );
  assert.equal(plannerFollowUpError("pb-auth"), undefined);
});
