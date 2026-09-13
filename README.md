# Flight Director

Flight Director gives Pi a small, visible delegation system built on Herdr.
It routes research and review to GPT-5.6 Luna at xhigh effort and implementation to GPT-5.6 Sol at medium effort.
Every specialist runs in a named tab inside the current Herdr workspace.

## Roles

| Role | Tab prefix | Purpose |
| --- | --- | --- |
| Flight Director | `fd` | Own the user request and coordinate work |
| Probe | `pb` | Investigate without changing the project |
| Engineer | `eng` | Implement changes |
| Inspector | `ins` | Review without changing the project |

Flight Director delegates only when a separate context or independent workstream is useful.
The default limit is two working specialists and one Engineer per checkout.

## Requirements

- [Pi](https://github.com/badlogic/pi-mono)
- [Herdr](https://herdr.dev/)
- Access to `openai-codex/gpt-5.6-luna` and `openai-codex/gpt-5.6-sol`

Flight Director only activates inside a Herdr session.

## Install

```bash
pi install git:github.com/zav-developer/flight-director
```

Restart Pi after installation.
Ask Pi to delegate work, use subagents, or run an independent review.
The `flight-director` skill will guide orchestration and the extension will provide `fd_dispatch`, `fd_agents`, `fd_result`, `fd_prompt`, and `fd_stop`.

## Project policy

Copy `.fd-policy.example.md` to `.fd/policy.md` inside a project and adjust it locally.
The `.fd` directory should remain untracked.
Policy can choose checkout isolation, delivery style, validation depth, approval points, and required evidence without coupling those choices together.

## Scope

The first release deliberately has no daemon, persistent backlog, remote coordinators, quota router, or terminal abstraction.
Treehouse worktrees, pull requests, and no-mistakes remain optional tools selected by policy and task risk.

## Acknowledgments

Flight Director is an independent implementation inspired by Kun Chen's [firstmate](https://github.com/kunchenguid/firstmate), [treehouse](https://github.com/kunchenguid/treehouse), and [no-mistakes](https://github.com/kunchenguid/no-mistakes).
Those projects established many of the orchestration, isolation, and validation ideas explored here.
Flight Director is not affiliated with or endorsed by Kun Chen.

## License

MIT
