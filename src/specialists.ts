import { fileURLToPath } from "node:url";

export const roles = {
  probe: {
    prefix: "pb",
    model: "openai-codex/gpt-5.6-luna",
    thinking: "xhigh",
    tools: "read,grep,find,ls,bash",
    prompt: fileURLToPath(new URL("../roles/probe.md", import.meta.url)),
  },
  planner: {
    prefix: "pln",
    model: "openai-codex/gpt-6-astra",
    thinking: "medium",
    prompt: fileURLToPath(new URL("../roles/planner.md", import.meta.url)),
    isolated: true,
  },
  engineer: {
    prefix: "eng",
    model: "openai-codex/gpt-5.6-sol",
    thinking: "medium",
    prompt: fileURLToPath(new URL("../roles/engineer.md", import.meta.url)),
  },
  inspector: {
    prefix: "ins",
    model: "openai-codex/gpt-5.6-luna",
    thinking: "xhigh",
    tools: "read,grep,find,ls,bash",
    prompt: fileURLToPath(new URL("../roles/inspector.md", import.meta.url)),
  },
} as const;

export type Role = keyof typeof roles;

type SessionArgs = {
  sessionDir: string;
  sessionId: string;
  name: string;
  reportProtocol: string;
};

export function buildPiArgs(role: Role, session: SessionArgs): string[] {
  const spec = roles[role];
  const args = [
    "--session-dir",
    session.sessionDir,
    "--session-id",
    session.sessionId,
    "--model",
    spec.model,
    "--thinking",
    spec.thinking,
    "--append-system-prompt",
    spec.prompt,
    "--append-system-prompt",
    session.reportProtocol,
    "--name",
    session.name,
    "--exclude-tools",
    "fd_dispatch,fd_agents,fd_result,fd_prompt,fd_stop",
  ];

  if ("isolated" in spec && spec.isolated)
    args.push("--no-tools", "--no-skills", "--no-context-files");
  else {
    args.push("--approve");
    if ("tools" in spec && spec.tools) args.push("--tools", spec.tools);
  }
  return args;
}

export function dispatchPrompt(
  role: Role,
  task: string,
  context?: string,
): string {
  if (role !== "planner") return `Task:\n${task}`;
  if (!context?.trim())
    throw new Error("Planner context is required and must be nonblank");
  return `Task:\n${task}\n\nEvidence packet:\n${context}`;
}

export function isSpecialist(label: string): boolean {
  return /^(pb|pln|eng|ins)-/.test(label);
}

export function plannerFollowUpError(label: string): string | undefined {
  if (!label.startsWith("pln-")) return undefined;
  return "Planner is one-shot. Launch a fresh Planner with a complete context packet.";
}
