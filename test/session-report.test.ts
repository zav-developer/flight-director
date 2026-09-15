import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findSessionFile, readFinalReport } from "../src/session-report.ts";

function sessionFile(lines: object[]): string {
  const directory = mkdtempSync(join(tmpdir(), "fd-report-test-"));
  const file = join(directory, "session.jsonl");
  writeFileSync(file, lines.map((line) => JSON.stringify(line)).join("\n"));
  return file;
}

test("finds a Pi session by its explicit ID", () => {
  const directory = mkdtempSync(join(tmpdir(), "fd-session-test-"));
  const expected = join(directory, "2026-01-01T00-00-00-000Z_agent-123.jsonl");
  writeFileSync(expected, "");

  assert.equal(findSessionFile(directory, "agent-123"), expected);
});

test("reads the tagged final assistant report from Pi JSONL", () => {
  const file = sessionFile([
    {
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "old output" }],
      },
    },
    {
      type: "message",
      message: {
        role: "toolResult",
        content: [{ type: "text", text: "terminal garbage" }],
      },
    },
    {
      type: "message",
      message: {
        role: "assistant",
        content: [
          {
            type: "text",
            text: "Context\n<FD_RESULT>The real report.</FD_RESULT>",
          },
        ],
      },
    },
  ]);

  assert.equal(readFinalReport(file), "The real report.");
});

test("fails closed when no tagged final report exists", () => {
  const file = sessionFile([
    {
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "unstructured terminal output" }],
      },
    },
  ]);

  assert.throws(() => readFinalReport(file), /tagged final report/i);
});
