# Management Memory Reference

This document owns the contract for the manager Inbox and read-only Reports archive.

## Inbox

The Inbox is a pure read model over authoritative career facts. It does not persist read, unread, dismissed, or
acknowledged state.

Current sources include:

- a finalized current-season review that requires explicit next-season acknowledgement
- required post-match review and open managed-match windows
- event entry deadlines within three days
- Rotation/Development preparation and next-day payroll tasks
- active medical load, scouting assignments, promises, and facility construction

Every item has a stable ID derived from its source fact, a priority, due date, explanation, and semantic destination.
Inbox buttons navigate to the owning desk. They do not perform the underlying gameplay action. Re-projecting after the
owning action resolves removes or changes the item idempotently.

Portal urgent tasks consume the same Inbox selector so Portal and Inbox cannot drift into separate decision formulas.

## Reports

Reports is distinct from the blocking post-match Review workflow.

- `review` is allowed to settle and continue a current post-match state.
- `reports` is read-only for archived facts and must never expose Continue, Close Event, or match settlement.
- A finalized current season may expose one explicit **Start Next Season** lifecycle action. That action is available
  only against the matching review and does not rewrite the report.

The archive contains only persisted facts:

- managed-player match-history rows
- event closeouts
- live and expired scouting reports
- retained development baselines and preparation records
- finalized season reviews with event-edition, ranking, record, and economy snapshots

`lastMatchReport` is the only detailed match record with evidence, recommendations, and tactical-viewer data. Historical
match rows must not borrow or synthesize that detail. Empty and migrated gaps say **Not recorded in this save**.

Program, media, and development logs are bounded arrays. If surfaced, they must be described as retained activity, not
lifetime history.

## Navigation

`ManagementDestination` is a semantic core-to-UI contract. Destinations include Review, Reports, Live Match, Training, Program,
Scouting, Promises, Facilities, Player Profile, and a season-qualified Tournament address. React maps destinations to
pages; the read model does not call the store.

## Verification

- selector output is deterministic, stably ordered, and duplicate-free
- underlying action transitions replace or remove Inbox facts
- Reports includes only matches involving the managed athlete
- expired scout reports remain readable
- Reports works without `lastMatchReport`
- detailed evidence is never copied to older match rows
- opening Inbox/Reports does not mutate the save
- starting a next season requires a matching finalized review and is idempotent after rollover
- both pages remain bounded at 320, 768, 1024, and 1440 pixels
