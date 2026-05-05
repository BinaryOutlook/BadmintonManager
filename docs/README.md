# Documentation Harness

This repo uses an agent-first documentation harness: the repository is the shared memory layer for humans and AI agents.

The goal is faster re-entry, fewer pasted prompts, and more reliable implementation loops.

$$
\text{Agent I/O speed} \approx \frac{\text{discoverable context} + \text{tests} + \text{clear boundaries}}{\text{manual explanation}}
$$

## Map

```text
AGENTS.md
  |
  v
docs/README.md
  |
  +-- product/              stable product truth and versioned release packets
  +-- architecture/         implementation strategy and module boundaries
  +-- reference/            subsystem contracts
  +-- plans/active/         current execution state
  +-- decisions/            architecture decision records
```

## Source Of Truth

| Need | Read | Update when |
| --- | --- | --- |
| Fast session entry | `AGENTS.md` | Routing or required commands change |
| Product direction | `docs/product/PRD.md` | The product thesis, scope, or non-goals change |
| Milestone sequence | `docs/product/ROADMAP.md` | Version order, goals, or exit criteria change |
| Current release work | `docs/product/versions/v0.2.2/v0.2.2.md` | The active version scope changes |
| Current project state | `docs/plans/active/project-status.md` | Work completes, next work changes, blockers appear |
| Architecture boundaries | `docs/architecture/overview.md` | Module ownership or runtime boundaries change |
| Subsystem rules | `docs/reference/*.md` | Engine, tactics, player, or tournament contracts change |
| Big technical decisions | `docs/decisions/ADR-*.md` | A costly-to-reverse decision is accepted or superseded |

## Versioning Rules

- Stable product truth lives in `docs/product/PRD.md`.
- Release-specific scope lives in `docs/product/versions/vX.Y/` or `docs/product/versions/vX.Y.Z/`.
- UI demo inputs and design references stay inside the version folder that uses them.
- ADRs are append-only historical context. Supersede them with a new ADR instead of deleting old decisions.
- Active execution state lives in `docs/plans/active/`; completed plans can later move to `docs/plans/completed/`.

## Progressive Disclosure

For most coding tasks, read in this order:

1. `AGENTS.md`
2. `docs/plans/active/project-status.md`
3. The narrow source or test files for the task
4. The relevant subsystem reference in `docs/reference/`
5. The active version packet only if product intent is unclear

For product or architecture tasks, start with:

1. `docs/product/PRD.md`
2. `docs/product/versions/v0.2.2/v0.2.2.md`
3. `docs/architecture/overview.md`
4. Related ADRs in `docs/decisions/`

## Update Contract

When code changes materially, update the smallest doc that would help the next session:

- new gameplay behavior -> active version packet or subsystem reference
- changed module boundary -> architecture overview
- changed accepted technical direction -> ADR
- changed work status -> active project status
- changed verification command or setup -> `README.md` and `AGENTS.md`

The rule of thumb: if a future agent would otherwise need a chat transcript to understand the change, put the knowledge in the repo.
