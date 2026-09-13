---
name: flight-director
description: Coordinate delegated coding work as visible Pi agents in the current Herdr workspace. Use when the user asks for subagents, delegation, parallel work, or a complex task has an independent research, implementation, or review track. Requires HERDR_ENV=1.
---

# Flight Director

Keep command of the task in the current agent.
Delegate only when an independent track or fresh context earns the extra model call.

## Dispatch

1. Read `.fd/policy.md` when it exists.
2. Choose the narrowest role that owns the delegated outcome.
3. Call `fd_dispatch` with a short topic label and the intended checkout as `cwd`.
4. Keep at most two specialists working concurrently and one Engineer per checkout.
5. Call `fd_result` when the result is needed.
6. Integrate the result yourself and report one coherent outcome to the user.

| Role | Tab | Model | Authority |
| --- | --- | --- | --- |
| Probe | `pb-<topic>` | Luna xhigh | Investigate without project changes |
| Engineer | `eng-<topic>` | Sol medium | Implement within the assigned scope |
| Inspector | `ins-<topic>` | Luna xhigh | Review without project changes |

Use a Probe for research or codebase reconnaissance.
Use an Engineer for every delegated implementation.
Use an Inspector after changes when independent review is worthwhile.
Send substantive Inspector findings to an Engineer rather than asking the Inspector to fix them.

## Isolation and delivery

Use the shared checkout for read-only work and one Engineer when the user is not editing concurrently.
Use a worktree for overlapping writers, concurrent user edits, risky changes, or work expected to become a pull request.
Treat worktrees, pull requests, validation, and user approval as separate choices.
Use no-mistakes only when local policy or the user selects its full pull-request pipeline.

Pause at approval points named by local policy.
Without local policy, pause before destructive actions, push, and merge.
Keep specialist tabs visible through the final summary.
Close them only when the user asks or cleanup is clearly part of the task.
