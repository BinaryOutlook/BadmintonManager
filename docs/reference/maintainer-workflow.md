# Maintainer Workflow Reference

This is the short operational checklist for humans and agents changing **Badminton Manager**.

Rule of thumb:

$$
\text{If the next agent would need your chat transcript, document it.}
$$

## Before Changing A Feature

Read only the context you need:

1. `AGENTS.md` for mission, commands, boundaries, and documentation discipline.
2. `docs/README.md` for the documentation map and update ownership.
3. `docs/plans/active/project-status.md` for current phase, next work, and blockers.
4. The narrow reference under `docs/reference/` for the subsystem you are touching.
5. The relevant source and test files.
6. `docs/product/PRD.md` or the active version packet if product intent is unclear.

Do not treat old tickets, scratchpads, or release-history packets as the primary current contract when a newer reference or implementation disagrees.

## Choosing The Right Doc

| You changed | Update |
| --- | --- |
| Gameplay rule, simulation behavior, tactics, tournament flow, career calendar, ranking, player record, or save behavior | Matching `docs/reference/` file |
| Source ownership, route/page structure, runtime boundary, or test strategy | `docs/architecture/overview.md` |
| Product scope, player-facing behavior, or non-goal | `docs/product/PRD.md` or active version packet |
| Current project phase, next work, or blockers | `docs/plans/active/project-status.md` |
| Setup, command, verification, or documentation map | `README.md`, `AGENTS.md`, or `docs/README.md` |
| Costly-to-reverse decision | New ADR in `docs/decisions/` |

Update the smallest durable document. Do not duplicate an entire source file in prose.

## When To Write An ADR

Write an ADR when a decision is expensive to reverse or likely to be re-debated, such as:

- state library, routing, storage, or backend direction
- save format or migration strategy
- simulation ownership or fidelity split
- documentation/process contract
- major product boundary that affects architecture

ADRs are append-only decision history. If a decision changes, add a new ADR that supersedes the old one instead of deleting old context.

## Verification

Run the issue-specific checks first. Then run broader checks when source or behavior changes.

Common commands:

```sh
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

For documentation-system work, also run:

```sh
rg -n "game-mechanics|code-structure|save-and-persistence|maintainer-workflow|Documentation Discipline" AGENTS.md docs
rg -n "badminton-manager-save|badminton-manager-save-corrupt|SAVE|migration|import" game docs/reference
```

If you touch a page or browser flow, add or run focused Playwright proof. If you touch engine, career, tournament, selector, or save logic, add or run focused Vitest proof.

## Keeping Docs Fresh

- Document contracts, boundaries, invariants, and gotchas; avoid narration that only says a ticket happened.
- Prefer links from `docs/README.md` over repeating the same explanation in several places.
- Keep `AGENTS.md` compact so agents can actually read it every session.
- Keep references current with source paths and terminology.
- Mark historical or fallback behavior honestly; never describe old-save gaps as complete current truth.
