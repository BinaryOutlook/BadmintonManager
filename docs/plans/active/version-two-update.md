# Version Two Update Plan

Status: active implementation program  
Branch: `Version-Two-Update`  
GitHub milestone: [Version Two Update](https://github.com/BinaryOutlook/BadmintonManager/milestone/1)  
Started: 2026-07-13

## Objective

Turn the stable `v0.3` career foundation into a deeper coaching-management simulation while preserving the boundaries that already make the project trustworthy:

- the player is the coach, not the athlete
- singles remains the primary competition format
- identical seeds, state, tactics, and choices remain deterministic
- React presents state and captures intent; `game/` owns outcomes
- saves remain local-first, versioned, validated, portable, and recoverable
- fictional players and events remain the content boundary

The imagegen concept board is a visual direction, not a gameplay specification. Team rosters, multiple save cards, richer finance panels, and live-court treatments shown in that board must only appear when the underlying system supports them.

## Delivery Discipline

Every vertical slice follows:

```text
implement -> focused test -> full regression as risk requires -> visual check -> docs -> commit -> push
```

Commits must remain independently understandable and reversible. UI screenshots and automated assertions are evidence, not substitutes for verifying that displayed claims come from real game state.

## Workstreams

| Workstream | GitHub | Outcome |
| --- | --- | --- |
| Tactical fidelity | [#76](https://github.com/BinaryOutlook/BadmintonManager/issues/76) | Preserve advanced plan inputs through deterministic match resolution and evidence |
| Planning and development | [#75](https://github.com/BinaryOutlook/BadmintonManager/issues/75) | Deeper training, calendar commitments, Portal forecasts, and development history |
| Program ecosystem | [#74](https://github.com/BinaryOutlook/BadmintonManager/issues/74) | Real squad, scouting, recruitment, staff, youth, finance, and psychology workflows |
| Career lifecycle | [#77](https://github.com/BinaryOutlook/BadmintonManager/issues/77) | Multi-season progression, generated future world state, Inbox, and Reports memory |
| Save trust | [#78](https://github.com/BinaryOutlook/BadmintonManager/issues/78) | Football Manager-style multi-slot local saves, backups, metadata, and recovery |
| UX cross-validation | [#80](https://github.com/BinaryOutlook/BadmintonManager/issues/80) | Continuous responsive, accessible, state-backed visual QA |

## Dependency Order

1. Tactical fidelity and match evidence establish the highest-value coaching depth.
2. Training, Calendar, Portal, and player development create a coherent daily preparation loop.
3. The program ecosystem expands from one locked athlete toward an actual managed program.
4. Multi-season progression gives those systems a durable career arc.
5. Multi-slot saves land against the mature Version Two state model, while additive backup metadata may land earlier.
6. UX cross-validation runs throughout every workstream rather than waiting for final polish.

## Completion Matrix

| Requirement | Required proof |
| --- | --- |
| Advanced tactics affect real matches | Engine-level tests for each input, deterministic golden checks, live/post-match evidence |
| Daily planning is sophisticated | Calendar aggregation, Portal forecast selectors, training/development state tests, responsive screenshots |
| Program management is real | Multi-athlete end-to-end flow across roster, schedule, training, finance, and match entry |
| Career persists across seasons | Multi-season simulation tests, aging/generation invariants, history and save round trips |
| Save trust matches the new scope | Legacy migration, multi-slot isolation, backup/quarantine recovery, import failure safety |
| UI remains truthful and usable | Viewport/state matrix, keyboard/focus checks, no decorative controls, no unsupported claims |
| Release remains maintainable | Typecheck, unit, build, e2e, relevant calibration, docs, clean Git history |

## UX Verification Matrix

Critical surfaces must be checked at widths `320`, `768`, `1024`, and `1440` where the layout is applicable.

| Surface | Required states |
| --- | --- |
| Launch / Save Manager | empty, active career, active quick run, import preview, corrupt recovery, destructive confirmation |
| Portal | normal planning, required match, blocked action, low cash, injury, long task/evidence content |
| Calendar / Timeline | sparse month, dense month, past archive, confirmed match, deadline, cross-month navigation |
| Squad / Profile | world directory, program roster, long names, unknown evidence, managed and opponent profiles |
| Tactics / Pre-match | no report, partial report, verified report, modified plan, advice apply and override |
| Live / Review | early set, interval, deciding set, complete match, long commentary, tactical-map density |
| Program desks | empty, affordable, unaffordable, capacity full, pending, completed, failed/recovery states |

For every state, verify horizontal overflow, clipped controls, focus order, visible focus, heading hierarchy, non-color status labels, modal focus containment, and that the primary next action remains discoverable.

### Shell checkpoint — 2026-07-13

- At `320` and `768`, the permanent abbreviation rail is replaced by a full-label navigation drawer so the page canvas keeps the full viewport width.
- The drawer is inert while closed, traps keyboard focus while open, closes on `Escape`, restores focus to its trigger, and prevents background scrolling.
- At `1024`, the non-functional command field no longer truncates the product or managed-athlete identity; the full command surface remains available at `1440`.
- `e2e/version-two-responsive.spec.ts` enforces all four widths, horizontal bounds, mobile drawer geometry, full command labels, focus restoration, and identity-label truncation.
- Optional visual evidence can be regenerated with `VERSION_TWO_SCREENSHOT_DIR=<directory> npx playwright test e2e/version-two-responsive.spec.ts`.

### Lifecycle and save checkpoint — 2026-07-13

- Save version 13 / career 11 qualifies event editions and archive facts by season, preserves generated future dates,
  and migrates version-12 careers without fabricating season reviews.
- Season close requires terminal universe truth and no pending match or preparation intent. Reports is the explicit
  boundary for opening the next generated calendar.
- Season start now advances a persistent, deterministic world registry: stored peak/decline curves, retirement,
  fictional intake, active-world rankings/event fields, rival synchronization, and generated-player profiles are backed
  by current save state. A 20-season save round trip and multi-season golden guard the long-run contract.
- Browser persistence uses independent named envelopes, a verified active pointer, two rolling per-slot checkpoints,
  and isolated quarantine records. Import creates a new slot; restore writes a new revision.
- Slot switching, rename, duplicate, archive/restore, permanent delete, legacy singleton migration, and backup restore
  have focused repository/store coverage. Responsive and keyboard Save Manager proof remains part of the UX gate.

## Save Invariants

Version Two persistence work must preserve these rules:

1. Never overwrite a known-good save before a candidate import has parsed, validated, migrated, and previewed successfully.
2. Corruption in one future slot must not quarantine or delete another slot.
3. Legacy `badminton-manager-save` data must migrate once without losing active career or tournament facts.
4. Backup recovery must be explicit and inspectable.
5. Save metadata must name slot, mode, game date, real timestamp, schema version, program/athlete, and recovery state.
6. Simulation must never fabricate unavailable legacy history merely to populate a richer UI.

## Exit Gate

The Version Two milestone is complete only when all six GitHub workstreams have satisfied their acceptance evidence, the completion matrix above is proven from current code and artifacts, and no required migration or UX state is supported only by assumption.
