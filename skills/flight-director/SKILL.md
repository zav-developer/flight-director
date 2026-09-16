---
name: flight-director
description: Coordinate delegated coding work as visible Pi agents in the current Herdr workspace. Use when the user asks for subagents, delegation, parallel work, or a complex task has an independent research, implementation, or review track. Requires HERDR_ENV=1.
---

# Flight Director

Keep command of the task in the current agent.
Delegation must buy parallelism, independent judgment, or meaningful context isolation.

## Triage

Read `.fd/policy.md` when it exists.

Handle a task directly when it is one obvious operation, a small edit, or a correction whose scope is already known.
Do not delegate merely because Flight Director is available.
A single capable agent should remain the fastest path for small work.

Use one specialist when the task has a bounded independent outcome.
Use a sequence or parallel specialists only when their workstreams are genuinely independent or require different authority.
Do not send a Probe before an Engineer when the Engineer can cheaply inspect the necessary context.

## Planning sequence

Use Planner when an expensive or constrained implementation benefits from a separate decision pass.
Do not add Planner to work whose implementation path is already clear.

1. Gather the evidence needed for the decision, using Probe only when separate investigation buys meaningful context isolation.
2. Assemble a self-contained packet with the current intent, relevant instructions, direct evidence, constraints, available options, and material uncertainty.
3. Dispatch Planner with the decision as `task` and the evidence packet as `context`.
4. Reconcile its one recommendation with the latest user intent, then give Engineer the accepted plan without making it rediscover the evidence.

Complete needed exploration before starting Planner.
Planner receives no project context beyond the packet and accepts no follow-up.
Launch a fresh Planner with a complete packet when another planning pass is needed.

## Dispatch

1. Restate the user's latest requested outcome before composing the assignment.
2. Choose the narrowest role that owns the delegated outcome.
3. Write a tight assignment with the current intent, completion condition, allowed scope, relevant known context, and a stopping boundary.
4. Call `fd_dispatch` with a short topic label and the intended checkout as `cwd`.

Use this shape when the boundaries are not already obvious:

```text
Current intent: <preserve the user's exact requested outcome>
Done when: <one checkable condition>
Scope: <named files, systems, or sources>
Known context: <only facts that save duplicated work>
Stop boundary: <what not to investigate; report material ambiguity>
```

Keep a bounded assignment short.
Do not turn a direct task into an audit.

5. Keep at most two specialists working concurrently and one Engineer per checkout.
6. End the turn after dispatching all currently useful work.

Luna remains at xhigh because its judgment is materially stronger there, but Luna xhigh can take a long time and tends to broaden investigations.
Tell every Probe and Inspector to start from the most likely direct evidence, use the smallest evidence set that answers the question, and stop when the completion condition is met.
Name specific files, sources, or command classes when they are already known.
Ask the specialist to report a material ambiguity instead of exploring every possible branch.
Avoid stacking redundant validation requests in one assignment.

Preserve the user's wording for identity-sensitive or easily confused choices such as names, products, versions, and requested alternatives.
The latest user message is authoritative.
Never contradict it in a downstream assignment without first asking the user.

| Role      | Tab           | Model        | Authority                                                     |
| --------- | ------------- | ------------ | ------------------------------------------------------------- |
| Probe     | `pb-<topic>`  | Luna xhigh   | Investigate without project changes                           |
| Planner   | `pln-<topic>` | Astra medium | Produce a one-shot implementation plan from a complete packet |
| Engineer  | `eng-<topic>` | Sol medium   | Implement within the assigned scope                           |
| Inspector | `ins-<topic>` | Luna xhigh   | Review without project changes                                |

Use a Probe for research or codebase reconnaissance that would otherwise consume substantial coordinator context.
Use an Engineer for delegated implementation.
Use an Inspector after changes when independent review is worthwhile.
Send substantive Inspector findings to an Engineer rather than asking the Inspector to fix them.

## Completion events

`fd_dispatch` returns as soon as the specialist is working.
Do not call `fd_result` with the intent to wait.
Flight Director will receive a specialist event when an agent becomes done or blocked.
A user message may arrive first and is equally authoritative.
On either event, reassess the latest user intent before continuing.

Consume a completed result once, integrate it into the task, then call `fd_stop` before the final response.
Keep blocked specialists available while resolving their question.
Keep completed tabs only when the user explicitly asks to inspect them.

## Isolation and delivery

Use the shared checkout for read-only work and one Engineer when the user is not editing concurrently.
Use a worktree for overlapping writers, concurrent user edits, risky changes, or work expected to become a pull request.
Treat worktrees, pull requests, validation, and user approval as separate choices.
Use no-mistakes only when local policy or the user selects its full pull-request pipeline.

Pause at approval points named by local policy.
Without local policy, pause before destructive actions, push, and merge.
