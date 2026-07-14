# Documentation Map

This directory is the durable system memory for **Badminton Manager**. Start here when you need to know which document owns product truth, architecture boundaries, subsystem contracts, active work, or historical context.

The first stop for agents is still `AGENTS.md`; the first stop for documentation routing is this file.

**maintainable system memory = orientation + contracts + decision history + update discipline**

## First Stops

| Need | Read first | Why |
| --- | --- | --- |
| Fast agent entry | [`../AGENTS.md`](../AGENTS.md) | Compact mission, rules, commands, and documentation discipline |
| Documentation routing | [`docs/README.md`](README.md) | The map you are reading now |
| Current project state | [`plans/active/project-status.md`](plans/active/project-status.md) | Current phase, completed work, next work, blockers |
| Version Two execution plan | [`plans/active/version-two-update.md`](plans/active/version-two-update.md) | Workstreams, dependency order, save invariants, and UX verification matrix |
| Stable product truth | [`product/PRD.md`](product/PRD.md) | Product identity, goals, non-goals, and player fantasy |
| Active release packet | [`product/versions/v0.3/v0.3.md`](product/versions/v0.3/v0.3.md) | Stable career-system release context |
| Architecture map | [`architecture/overview.md`](architecture/overview.md) | Runtime layers, module ownership, and test strategy |
| Subsystem contracts | [`reference/`](reference/) | Durable gameplay, engine, persistence, and code-structure references |
| Costly decisions | [`decisions/`](decisions/) | ADRs; append or supersede rather than rewrite history |

## Sources Of Truth

### Product Truth

- [`product/PRD.md`](product/PRD.md) owns the stable product thesis: the player is the coach and manager, not the athlete controller.
- [`product/ROADMAP.md`](product/ROADMAP.md) owns version sequencing and exit criteria.
- [`product/versions/v0.3/v0.3.md`](product/versions/v0.3/v0.3.md) is the active stable career-system packet.
- Older version packets under `product/versions/` explain historical delivery context. They are useful references, not the primary current contract.

### Architecture Truth

- [`architecture/overview.md`](architecture/overview.md) owns the high-level local-first SPA map, runtime boundaries, module ownership, and verification strategy.
- Major irreversible architecture or process decisions belong in [`decisions/`](decisions/).

### Subsystem Contracts

Use the smallest matching reference before changing behavior:

- [`reference/game-mechanics.md`](reference/game-mechanics.md) - player fantasy, controllable inputs, simulated outputs, match/career/world flow
- [`reference/code-structure.md`](reference/code-structure.md) - practical source-tree map and dangerous-change zones
- [`reference/save-and-persistence.md`](reference/save-and-persistence.md) - local save keys, schemas, migration, import/export, and recovery invariants
- [`reference/maintainer-workflow.md`](reference/maintainer-workflow.md) - short operational workflow for humans and agents
- [`reference/match-engine.md`](reference/match-engine.md) - compact match-engine contract
- [`reference/match-simulation-fidelity.md`](reference/match-simulation-fidelity.md) - detailed versus quick simulation plan and fidelity rules
- [`reference/match-balance-calibration.md`](reference/match-balance-calibration.md) - OVR-gap balance harness and calibration bands
- [`reference/stat-composition-calibration.md`](reference/stat-composition-calibration.md) - rating-field influence and same-OVR archetype harness
- [`reference/career-calendar-ranking.md`](reference/career-calendar-ranking.md) - calendar, deadlines, rankings, event history, and profile-record truth
- [`reference/tournament-system.md`](reference/tournament-system.md) - 16-player knockout, quick background matches, bracket progression, archives
- [`reference/player-model.md`](reference/player-model.md) - player schema, ratings, derived attributes, traits
- [`reference/tactics-system.md`](reference/tactics-system.md) - tactical inputs, team talks, bounded tactical effects
- [`reference/program-ecosystem.md`](reference/program-ecosystem.md) - program identity, roster preparation, recruitment evidence, payroll, and talent-pool evolution
- [`reference/management-memory.md`](reference/management-memory.md) - actionable Inbox projection, read-only Reports archive, and semantic navigation

### Active Work And History

- Active ticket specs live in [`active_tix/`](active_tix/).
- Archived ticket specs live in [`arc_tix/`](arc_tix/).
- Rescue-MVP planning history lives in [`rescue_MVP/`](rescue_MVP/).
- Scratch notes are not source of truth unless promoted into product, architecture, reference, plan, or ADR docs.

Historical tickets and release packets explain why the project moved, but current implementation work should route through the product, architecture, reference, plan, and decision documents above.

## Documentation Ownership

| Change type | Required doc update |
| --- | --- |
| Game mechanic changes | Matching `docs/reference/` file, usually `reference/game-mechanics.md` or a narrower subsystem reference |
| Match simulation changes | `reference/match-engine.md` or `reference/match-simulation-fidelity.md`; update calibration references if tuning changes |
| Career calendar/ranking changes | `reference/career-calendar-ranking.md` |
| Tournament-world changes | `reference/tournament-system.md` or a new world-simulation reference if the current file is too narrow |
| Save schema/migration changes | `reference/save-and-persistence.md` |
| Module boundary changes | `architecture/overview.md` |
| Route/page structure changes | `architecture/overview.md` and, if practical routing changed, `reference/code-structure.md` |
| Public data contract changes | Matching `reference/` file and affected product/version packet when player-facing |
| Product scope or player-facing behavior changes | `product/PRD.md` or the active version packet |
| Setup, command, or verification changes | `../README.md`, `../AGENTS.md`, or this file |
| Current execution-state changes | `plans/active/project-status.md` |
| Major irreversible decisions | New ADR in `decisions/` that supersedes older ADRs when needed |

## Update Contract

When code changes materially, update documentation in the same work session.

**code change + stale docs = future archaeology**

Rules of thumb:

1. Update the smallest durable document that would help the next maintainer.
2. Prefer one precise subsystem reference over broad release-history narration.
3. Keep `AGENTS.md` compact; route to this map instead of pasting manuals there.
4. Treat ADRs as append-only decision history. Supersede with a new ADR rather than deleting prior context.
5. If the next agent would need your chat transcript, document it.

## Verification

For documentation-only work, at minimum check links and search for the expected anchors. For system changes, run the relevant project checks from the root README and `AGENTS.md`.

Useful commands:

```sh
rg -n "game-mechanics|code-structure|save-and-persistence|maintainer-workflow|Documentation Discipline" AGENTS.md docs
rg -n "badminton-manager-saves|badminton-manager-save|SAVE|migration|import" game docs/reference
npm run typecheck
npm run test
```
