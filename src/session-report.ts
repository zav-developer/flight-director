import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function findSessionFile(sessionDir: string, sessionId: string): string {
  const suffix = `_${sessionId}.jsonl`;
  const matches = readdirSync(sessionDir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => join(sessionDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  if (!matches[0]) throw new Error(`Pi session ${sessionId} was not found`);
  return matches[0];
}

export function readFinalReport(sessionFile: string): string {
  const lines = readFileSync(sessionFile, "utf8").trim().split(/\r?\n/);

  for (let index = lines.length - 1; index >= 0; index--) {
    let entry: any;
    try {
      entry = JSON.parse(lines[index]);
    } catch {
      continue;
    }
    if (entry.type !== "message" || entry.message?.role !== "assistant")
      continue;

    const text = (entry.message.content || [])
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("\n");
    const match = text.match(/<FD_RESULT>\s*([\s\S]*?)\s*<\/FD_RESULT>/);
    if (match) return match[1].trim();
  }

  throw new Error("Pi session has no tagged final report");
}
