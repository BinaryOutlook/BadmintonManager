# TIX-022: Documentation System and Maintainer Harness

Status: Draft documentation ticket
Priority: Critical
Target project: `BadmintonManager`
Target systems: documentation harness, architecture references, gameplay mechanism references, maintainer workflow, agent entrypoint
Prepared on: 2026-05-20
Primary files: `AGENTS.md`, `docs/README.md`, `docs/architecture/overview.md`, `docs/reference/`, `docs/decisions/`
Suggested new files: `docs/reference/game-mechanics.md`, `docs/reference/code-structure.md`, `docs/reference/save-and-persistence.md`, `docs/reference/maintainer-workflow.md`
Reference input: maintainer request for a durable documentation system for humans and agents
Remediates: scattered documentation, unclear source-of-truth ownership, weak documentation update enforcement

## 1. Commander Intent

Build a durable documentation system for **Badminton Manager** so future maintainers and agents can understand how the game works, how the code is organized, and which documents must evolve when systems change.

The desired shift is:

**documentation as scattered notes → documentation as system infrastructure**

The final result should make the project easier to enter, modify, review, and extend without requiring old chat transcripts or archaeological code reading.

This is not a request for decorative documentation. It is a system-engineering pass.

## 2. Why This Ticket Exists

The project has grown from a small local-first prototype into a layered sports-management simulation. It now includes:

- deterministic match simulation,
- quick and detailed match modes,
- tournament progression,
- a career calendar,
- rankings and event tiers,
- player profile records,
- save import/export/migration,
- local persistence safety,
- route-like app pages,
- reusable UI surfaces,
- active tickets and archived release notes.

There are useful docs already, but the knowledge is distributed across product notes, version packets, active plans, ticket archives, subsystem references, and source code.

That creates a maintenance risk:

**new contributor + large system - clear map = blind-box development**

As the system gets bigger, the documentation must become a first-class maintenance surface. Future agents should know when code changes require documentation updates, and future humans should be able to understand the game without mentally rebuilding it from scattered implementation details.

## 3. Non-Negotiable Outcome

After this ticket is complete, a new agent or maintainer should be able to answer these questions quickly:

- What kind of game is this?
- What can the player control, and what does the simulation control?
- How does a match resolve?
- How does a career day progress?
- How do tournaments, rankings, player records, and save data interact?
- Where does each major piece of code live?
- Which files own gameplay rules versus presentation?
- What documentation must be updated when a subsystem changes?
- When should an ADR be written?

The documentation should make this core boundary obvious:

**React UI → player intent → game state → simulation engine → events, records, saves, presentation**

## 4. Required Documentation Deliverables

### 4.1 Update `AGENTS.md`

Modify `AGENTS.md` so every future agent sees documentation upkeep as part of normal engineering work.

Required additions:

- Add a compact "Documentation Discipline" or equivalent section.
- Tell agents that material system changes must update the relevant documentation in the same work session.
- Clarify that documentation updates are required when changing gameplay rules, architecture boundaries, persistence schemas, route/page structure, public data contracts, or verification commands.
- Keep `AGENTS.md` short. It must remain a routing document, not a full manual.
- Link to the documentation map in `docs/README.md`.
- Tell agents to add or supersede ADRs in `docs/decisions/` for costly-to-reverse decisions.

Suggested contract:

```md
## Documentation Discipline

When changing a system, update the smallest durable document that would let the next maintainer understand the change without the chat transcript.

- Gameplay or simulation rule change -> `docs/reference/`
- Architecture or module boundary change -> `docs/architecture/overview.md`
- Save schema, migration, or persistence behavior change -> save/persistence reference
- Product scope or player-facing behavior change -> `docs/product/`
- Expensive technical decision -> new ADR in `docs/decisions/`
- Setup, command, or verification change -> `README.md`, `AGENTS.md`, or `docs/README.md`
```

Do not paste this blindly if the final wording can be tighter. Preserve the existing compact tone of `AGENTS.md`.

### 4.2 Update `docs/README.md`

Turn `docs/README.md` into the true documentation index.

It must clearly answer:

- which document is the first stop,
- which documents define stable product truth,
- which documents define architecture,
- which documents define subsystem contracts,
- where active work lives,
- where historical tickets and release packets live,
- what must be updated when code changes.

It should also include a "Documentation Ownership" table:

| Change type | Required doc update |
| --- | --- |
| Game mechanic changes | Matching `docs/reference/` file |
| Match simulation changes | `docs/reference/match-engine.md` or `match-simulation-fidelity.md` |
| Career calendar/ranking changes | `docs/reference/career-calendar-ranking.md` |
| Tournament-world changes | `docs/reference/tournament-system.md` or new world-simulation reference |
| Save schema/migration changes | `docs/reference/save-and-persistence.md` |
| Module boundary changes | `docs/architecture/overview.md` |
| Major irreversible decisions | new ADR |

### 4.3 Create Or Update A Game Mechanics Reference

Create `docs/reference/game-mechanics.md` unless there is a better existing home.

This should explain the game as a system, not as marketing copy.

Minimum required sections:

- player fantasy: coach and manager, not athlete controller,
- controlled inputs: athlete choice, tactics, training/recovery, event entry, match decisions,
- simulated outputs: rally results, match scorelines, rankings, tournament records,
- match flow: pre-match, live match, between-set adjustments, post-match review,
- career flow: launch, managed athlete, day advancement, event entry, scheduled match days, archives,
- world model: managed athlete as one participant inside a broader circuit,
- deterministic principle: same seed and same inputs should produce stable outcomes,
- local-first principle: browser storage and portable JSON saves are core to the MVP.

Make the central product equation explicit:

**meaningful management = clear choices + trustworthy simulation + inspectable consequences**

### 4.4 Create Or Update A Code Structure Reference

Create `docs/reference/code-structure.md` unless the implementation agent finds a better name.

This document should describe the source tree in practical maintainer language.

Minimum required coverage:

- `app/`: top-level app composition, page registry, navigation helpers,
- `components/`: reusable UI surfaces and page-level workbenches,
- `game/core/`: deterministic match engine and core models,
- `game/career/`: career state, calendar, events, rankings, training, economy, health, hubs,
- `game/tournament/`: tournament setup, bracket progression, tournament metadata,
- `game/store/`: Zustand actions, local save orchestration, import/export behavior,
- `game/content/`: seeded fictional players, tactics, labels, static content,
- `game/commentary/`: readable text derived from engine events,
- `game/selectors/`: derived read models for pages and records,
- `tests/`: unit and integration coverage,
- `e2e/`: Playwright browser proof.

Required boundary statement:

**React components should render state and dispatch intent; game modules should decide outcomes.**

The document should identify files or folders that are dangerous to change casually, especially save migration, match simulation, tournament progression, and career date advancement.

### 4.5 Create Or Update A Save And Persistence Reference

Create `docs/reference/save-and-persistence.md` if current save behavior is not already covered clearly elsewhere.

Minimum required coverage:

- active local save key,
- corrupt-save quarantine key,
- save versioning,
- import validation,
- migration responsibilities,
- preview/confirm behavior,
- active save deletion,
- corrupt backup deletion,
- what must never happen during malformed import,
- what tests should cover when save shape changes.

The safety invariant should be explicit:

**invalid import ⇒ no active-save mutation**

### 4.6 Create Or Update A Maintainer Workflow Reference

Create `docs/reference/maintainer-workflow.md` or add an equivalent section in `docs/README.md`.

This should be short and operational.

It should explain:

- what to read before changing a feature,
- how to choose the right reference document,
- when to update project status,
- when to write an ADR,
- how to verify changes,
- how to keep documentation from becoming stale.

The rule of thumb:

**If the next agent would need your chat transcript, document it.**

## 5. Architecture Overview Requirements

Review and update `docs/architecture/overview.md` so it reflects the current system, not only the early MVP.

It should include:

- the current local-first SPA direction,
- the app/page shell,
- career system ownership,
- tournament system ownership,
- match engine ownership,
- save and persistence ownership,
- selector/read-model ownership,
- UI presentation boundary,
- test strategy.

If the overview becomes too long, keep the overview high-level and link to the new reference docs.

The architecture overview should remain a map, not a dumping ground.

## 6. ADR Requirement

Add a new ADR if the implementation agent judges this documentation system to be a durable process decision.

Recommended ADR:

```text
docs/decisions/ADR-003-documentation-as-maintenance-infrastructure.md
```

Suggested decision:

Badminton Manager treats documentation as part of the engineering contract. Material system changes must update the smallest relevant durable document in the same work session.

This ADR should explain why:

- the system is becoming too large for chat-transcript memory,
- agents and humans need stable re-entry points,
- scattered tickets are not enough,
- documentation must track system contracts, not just release history.

## 7. Documentation Quality Bar

The documentation must be:

- accurate to the current source tree,
- practical for maintainers,
- specific enough to route future work,
- concise enough to be read during real implementation,
- linked from the docs map,
- written in Markdown with clear headings,
- updated using the existing project terminology.

Avoid:

- vague slogans,
- duplicating entire code files,
- long release-history narration in subsystem docs,
- describing obsolete behavior as current behavior,
- turning `AGENTS.md` into a large manual.

## 8. Required Source Inspection

Before writing the docs, inspect the relevant code rather than relying only on old documentation.

At minimum, inspect:

- `app/`
- `components/CareerWorkbench.tsx`
- `game/core/`
- `game/career/`
- `game/tournament/`
- `game/store/`
- `game/selectors/`
- `tests/unit/`
- `e2e/`
- existing docs in `docs/reference/`, `docs/architecture/`, `docs/product/`, and `docs/decisions/`

Use the current code as truth when documentation and implementation disagree.

## 9. Acceptance Criteria

- [ ] `AGENTS.md` includes a compact documentation-discipline rule for future agents.
- [ ] `docs/README.md` clearly maps documentation sources of truth and update responsibilities.
- [ ] A game-mechanics reference exists and explains the management simulation model.
- [ ] A code-structure reference exists and explains where major systems live.
- [ ] Save and persistence behavior is documented in a durable reference, either new or existing.
- [ ] Maintainer workflow is documented, either as a new reference or a clear section in `docs/README.md`.
- [ ] `docs/architecture/overview.md` reflects the current post-`v0.3` system shape or links cleanly to updated references.
- [ ] ADR-003 is added or the implementation notes clearly justify why no ADR was necessary.
- [ ] New docs are linked from `docs/README.md`.
- [ ] No existing historical tickets or release packets are treated as the primary current source of truth.
- [ ] Documentation uses current file paths and current terminology.
- [ ] The implementation agent verifies all changed Markdown is readable and internally consistent.

## 10. Suggested Verification

Run these checks after editing:

```bash
rg -n "game-mechanics|code-structure|save-and-persistence|maintainer-workflow|Documentation Discipline" AGENTS.md docs
rg -n "badminton-manager-save|badminton-manager-save-corrupt|SAVE|migration|import" game docs/reference
npm run typecheck
```

`npm run typecheck` is not required because Markdown changed, but it is useful if the agent touches source files while validating documentation claims.

## 11. Out Of Scope

Do not implement new gameplay systems under this ticket.

Do not rewrite the entire PRD.

Do not move or delete historical release packets, archived tickets, visual QA artifacts, or rescue-MVP history unless explicitly requested.

Do not create a massive documentation portal. This pass should establish durable references and clear update rules.

The goal is maintainable system memory:

**good docs = orientation + contracts + decision history + update discipline**
