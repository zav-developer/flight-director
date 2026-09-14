import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const execFileAsync = promisify(execFile);
const MAX_WORKING_SPECIALISTS = 2;
const MAX_OUTPUT_CHARS = 12_000;
const reportProtocol = fileURLToPath(
  new URL("../roles/protocol.md", import.meta.url),
);

const roles = {
  probe: {
    prefix: "pb",
    model: "openai-codex/gpt-5.6-luna",
    thinking: "xhigh",
    tools: "read,grep,find,ls,bash",
    prompt: fileURLToPath(new URL("../roles/probe.md", import.meta.url)),
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

type Role = keyof typeof roles;
type HerdrResponse = {
  result?: Record<string, any>;
  error?: { code?: string; message?: string };
};

function result(text: string, isError = false) {
  return { content: [{ type: "text" as const, text }], isError };
}

function quote(value: unknown): string {
  return JSON.stringify(String(value ?? ""));
}

function finalReport(output: string): string {
  const reports = [
    ...output.matchAll(/<FD_RESULT>\s*([\s\S]*?)\s*<\/FD_RESULT>/g),
  ];
  return reports.at(-1)?.[1] || output;
}

function cleanError(error: any): string {
  const raw = error?.stdout || error?.stderr || error?.message || String(error);
  try {
    const parsed = JSON.parse(String(raw)) as HerdrResponse;
    return parsed.error?.message || parsed.error?.code || String(raw).trim();
  } catch {
    return String(raw).trim().split("\n").slice(-3).join(" ");
  }
}

async function runHerdr(args: string[], signal?: AbortSignal): Promise<string> {
  try {
    const { stdout } = await execFileAsync("herdr", args, {
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      signal,
      windowsHide: true,
    });
    return String(stdout);
  } catch (error) {
    throw new Error(cleanError(error));
  }
}

async function herdr(
  args: string[],
  signal?: AbortSignal,
): Promise<HerdrResponse> {
  try {
    const parsed = JSON.parse(await runHerdr(args, signal)) as HerdrResponse;
    if (parsed.error)
      throw new Error(
        parsed.error.message || parsed.error.code || "Herdr command failed",
      );
    return parsed;
  } catch (error) {
    throw new Error(cleanError(error));
  }
}

function workspaceId(): string {
  const id = process.env.HERDR_WORKSPACE_ID;
  if (!id)
    throw new Error("Flight Director requires an active Herdr workspace");
  return id;
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 20) || "task"
  );
}

async function workspaceTabs(signal?: AbortSignal): Promise<any[]> {
  const response = await herdr(
    ["tab", "list", "--workspace", workspaceId()],
    signal,
  );
  return response.result?.tabs || [];
}

async function workspacePanes(signal?: AbortSignal): Promise<any[]> {
  const response = await herdr(
    ["pane", "list", "--workspace", workspaceId()],
    signal,
  );
  return response.result?.panes || [];
}

function isSpecialist(label: string): boolean {
  return /^(pb|eng|ins)-/.test(label);
}

function uniqueName(
  prefix: string,
  topic: string,
  labels: Set<string>,
): string {
  const base = `${prefix}-${slug(topic)}`.slice(0, 28).replace(/-+$/g, "");
  if (!labels.has(base)) return base;
  for (let suffix = 2; suffix < 100; suffix++) {
    const candidate = `${base.slice(0, 28 - String(suffix).length)}-${suffix}`;
    if (!labels.has(candidate)) return candidate;
  }
  throw new Error(`Could not create a unique name for ${base}`);
}

async function agentInfo(target: string, signal?: AbortSignal): Promise<any> {
  const response = await herdr(["agent", "get", target], signal);
  return response.result?.agent;
}

async function specialistInfo(
  target: string,
  signal?: AbortSignal,
): Promise<any> {
  const info = await agentInfo(target, signal);
  if (!info || info.workspace_id !== workspaceId())
    throw new Error("The pane is not an agent in the current Herdr workspace");
  const tabResponse = await herdr(["tab", "get", info.tab_id], signal);
  const label = tabResponse.result?.tab?.label || "";
  if (!isSpecialist(label))
    throw new Error("The pane does not belong to a Flight Director specialist");
  return info;
}

const RoleSchema = Type.Union([
  Type.Literal("probe"),
  Type.Literal("engineer"),
  Type.Literal("inspector"),
]);

export default function flightDirector(pi: ExtensionAPI) {
  const watchers = new Map<string, AbortController>();

  const watch = (pane: string, name: string) => {
    watchers.get(pane)?.abort();
    const controller = new AbortController();
    watchers.set(pane, controller);

    void (async () => {
      await herdr(["agent", "wait", pane], controller.signal);
      const info = await specialistInfo(pane, controller.signal);
      if (!["idle", "done", "blocked"].includes(info?.agent_status)) return;

      let output = await runHerdr(
        [
          "agent",
          "read",
          pane,
          "--source",
          "recent-unwrapped",
          "--lines",
          "100",
          "--format",
          "text",
        ],
        controller.signal,
      );
      output = finalReport(output);
      if (output.length > MAX_OUTPUT_CHARS)
        output = output.slice(-MAX_OUTPUT_CHARS);

      const blocked = info.agent_status === "blocked";
      pi.sendMessage(
        {
          customType: "flight-director-event",
          content: [
            "Flight Director specialist event.",
            `Name: ${name}`,
            `Pane: ${pane}`,
            `Status: ${info.agent_status}`,
            blocked
              ? "The specialist needs intervention. Keep its tab open."
              : "Reconcile this result with the user's latest request, continue the task, then close the completed tab with fd_stop after consuming the result.",
            "Report:",
            output,
          ].join("\n"),
          display: true,
          details: { name, pane, status: info.agent_status },
        },
        { deliverAs: "followUp", triggerTurn: true },
      );
    })()
      .catch((error) => {
        if (!controller.signal.aborted)
          console.error(
            `Flight Director watcher failed for ${name}: ${cleanError(error)}`,
          );
      })
      .finally(() => {
        if (watchers.get(pane) === controller) watchers.delete(pane);
      });
  };

  pi.on("session_shutdown", async () => {
    for (const controller of watchers.values()) controller.abort();
    watchers.clear();
  });

  pi.registerTool({
    name: "fd_dispatch",
    label: "FD Dispatch",
    description:
      "Start one visible Probe, Engineer, or Inspector in the current Herdr workspace. Role determines model and effort. Returns immediately after work starts; completion or blockage wakes Flight Director automatically.",
    promptGuidelines: [
      "After fd_dispatch starts all currently useful specialists, end the turn instead of polling; specialist events wake Flight Director automatically.",
    ],
    parameters: Type.Object({
      role: RoleSchema,
      task: Type.String({
        description: "Complete task for the specialist",
        maxLength: 12_000,
      }),
      topic: Type.Optional(
        Type.String({
          description: "Short tab topic, such as auth or docs",
          maxLength: 40,
        }),
      ),
      cwd: Type.Optional(
        Type.String({
          description:
            "Checkout or worktree path; defaults to the Flight Director cwd",
        }),
      ),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      let tabId: string | undefined;
      try {
        const role = params.role as Role;
        const spec = roles[role];
        const cwd = params.cwd || ctx.cwd;
        const tabs = await workspaceTabs(signal);
        const working = tabs.filter(
          (tab) =>
            isSpecialist(tab.label || "") && tab.agent_status === "working",
        );
        if (working.length >= MAX_WORKING_SPECIALISTS) {
          return result(
            `error: ${MAX_WORKING_SPECIALISTS} Flight Director specialists are already working\nhelp: Run fd_agents and collect or stop one before dispatching another`,
            true,
          );
        }

        if (role === "engineer") {
          const tabById = new Map(tabs.map((tab) => [tab.tab_id, tab]));
          const panes = await workspacePanes(signal);
          const duplicate = panes.find((pane) => {
            const tab = tabById.get(pane.tab_id);
            return (
              tab?.label?.startsWith("eng-") &&
              pane.agent_status === "working" &&
              String(pane.cwd).toLowerCase() === cwd.toLowerCase()
            );
          });
          if (duplicate)
            return result(
              `error: an Engineer is already working in ${quote(cwd)}\nhelp: Give the new Engineer a separate worktree`,
              true,
            );
        }

        const name = uniqueName(
          spec.prefix,
          params.topic || params.task,
          new Set(tabs.map((tab) => tab.label)),
        );
        const created = await herdr(
          [
            "tab",
            "create",
            "--workspace",
            workspaceId(),
            "--cwd",
            cwd,
            "--label",
            name,
            "--no-focus",
          ],
          signal,
        );
        tabId = created.result?.tab?.tab_id;
        const paneId = created.result?.root_pane?.pane_id;
        if (!tabId || !paneId)
          throw new Error("Herdr did not return the new tab and pane IDs");

        const piArgs = [
          "--model",
          spec.model,
          "--thinking",
          spec.thinking,
          "--append-system-prompt",
          spec.prompt,
          "--append-system-prompt",
          reportProtocol,
          "--name",
          name,
          "--exclude-tools",
          "fd_dispatch,fd_agents,fd_result,fd_prompt,fd_stop",
          "--approve",
        ];
        if ("tools" in spec && spec.tools) piArgs.push("--tools", spec.tools);
        await herdr(
          [
            "agent",
            "start",
            name,
            "--kind",
            "pi",
            "--pane",
            paneId,
            "--timeout",
            "60000",
            "--",
            ...piArgs,
          ],
          signal,
        );
        await herdr(
          [
            "agent",
            "prompt",
            paneId,
            `Task:\n${params.task}`,
            "--wait",
            "--until",
            "working",
            "--timeout",
            "10000",
          ],
          signal,
        );
        watch(paneId, name);

        return result(
          [
            "agent:",
            `  name: ${quote(name)}`,
            `  role: ${role}`,
            `  status: working`,
            `  pane: ${quote(paneId)}`,
            `  tab: ${quote(tabId)}`,
            `  model: ${quote(spec.model)}`,
            `  effort: ${spec.thinking}`,
          ].join("\n"),
        );
      } catch (error) {
        if (tabId) await herdr(["tab", "close", tabId]).catch(() => undefined);
        return result(
          `error: ${cleanError(error)}\nhelp: Confirm Herdr is running and the requested cwd exists`,
          true,
        );
      }
    },
  });

  pi.registerTool({
    name: "fd_agents",
    label: "FD Agents",
    description:
      "List Flight Director specialist tabs in the current Herdr workspace.",
    parameters: Type.Object({}),
    async execute(_id, _params, signal) {
      try {
        const tabs = (await workspaceTabs(signal)).filter((tab) =>
          isSpecialist(tab.label || ""),
        );
        const panes = await workspacePanes(signal);
        const paneByTab = new Map(panes.map((pane) => [pane.tab_id, pane]));
        if (tabs.length === 0)
          return result(
            "agents: 0 Flight Director specialists found in this workspace",
          );
        const rows = tabs.map((tab) => {
          const pane = paneByTab.get(tab.tab_id);
          return `  ${quote(tab.label)},${tab.agent_status || "unknown"},${quote(pane?.pane_id || "")}`;
        });
        return result(
          `agents[${tabs.length}]{name,status,pane}:\n${rows.join("\n")}`,
        );
      } catch (error) {
        return result(`error: ${cleanError(error)}`, true);
      }
    },
  });

  pi.registerTool({
    name: "fd_result",
    label: "FD Result",
    description:
      "Read a specialist's current state without waiting. Completion and blockage normally arrive as automatic events.",
    promptGuidelines: [
      "Use fd_result only for a manual nonblocking status check; never poll a working specialist.",
    ],
    parameters: Type.Object({
      pane: Type.String({
        description: "Specialist pane ID returned by fd_dispatch",
      }),
    }),
    async execute(_id, params, signal) {
      try {
        const info = await specialistInfo(params.pane, signal);
        if (info?.agent_status === "working")
          return result(
            `agent:\n  status: working\n  pane: ${quote(params.pane)}\nhelp: End the turn and wait for the automatic specialist event`,
          );
        let output = await runHerdr(
          [
            "agent",
            "read",
            params.pane,
            "--source",
            "recent-unwrapped",
            "--lines",
            "100",
            "--format",
            "text",
          ],
          signal,
        );
        output = finalReport(output);
        const truncated = output.length > MAX_OUTPUT_CHARS;
        if (truncated) output = output.slice(-MAX_OUTPUT_CHARS);
        const lines = [
          "agent:",
          `  status: ${info?.agent_status || "unknown"}`,
          `  pane: ${quote(params.pane)}`,
          `  output: ${quote(output)}`,
        ];
        if (truncated)
          lines.push(
            "help: Recent output was truncated to its last 12000 characters",
          );
        return result(lines.join("\n"));
      } catch (error) {
        return result(
          `error: ${cleanError(error)}\nhelp: Run fd_agents to find valid specialist pane IDs`,
          true,
        );
      }
    },
  });

  pi.registerTool({
    name: "fd_prompt",
    label: "FD Prompt",
    description: "Send a follow-up instruction to a visible specialist.",
    parameters: Type.Object({
      pane: Type.String({ description: "Specialist pane ID" }),
      message: Type.String({
        description: "Follow-up instruction",
        maxLength: 12_000,
      }),
    }),
    async execute(_id, params, signal) {
      try {
        const info = await specialistInfo(params.pane, signal);
        await herdr(
          [
            "agent",
            "prompt",
            params.pane,
            `Follow-up:\n${params.message}`,
            "--wait",
            "--until",
            "working",
            "--timeout",
            "10000",
          ],
          signal,
        );
        watch(params.pane, info.name || params.pane);
        return result(
          `agent:\n  pane: ${quote(params.pane)}\n  status: working`,
        );
      } catch (error) {
        return result(`error: ${cleanError(error)}`, true);
      }
    },
  });

  pi.registerTool({
    name: "fd_stop",
    label: "FD Stop",
    description:
      "Close a completed specialist tab, or interrupt a working specialist with confirmation.",
    parameters: Type.Object({
      pane: Type.String({ description: "Specialist pane ID" }),
    }),
    async execute(_id, params, signal, _onUpdate, ctx) {
      try {
        const info = await specialistInfo(params.pane, signal);
        if (!info?.tab_id) throw new Error("The specialist has no Herdr tab");
        const settled = ["idle", "done"].includes(info.agent_status);
        if (!settled && !ctx.hasUI)
          return result(
            `error: ${info.agent_status} specialists require interactive confirmation before interruption`,
            true,
          );
        if (!settled) {
          const approved = await ctx.ui.confirm(
            "Interrupt specialist?",
            `Close tab ${info.tab_id} and terminate the ${info.agent_status} agent in ${params.pane}?`,
          );
          if (!approved) return result("status: canceled");
        }
        watchers.get(params.pane)?.abort();
        watchers.delete(params.pane);
        await herdr(["tab", "close", info.tab_id], signal);
        return result(
          `agent:\n  pane: ${quote(params.pane)}\n  status: stopped`,
        );
      } catch (error) {
        return result(`error: ${cleanError(error)}`, true);
      }
    },
  });
}
