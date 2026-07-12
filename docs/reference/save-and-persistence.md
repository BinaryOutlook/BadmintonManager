# Save And Persistence Reference

This document owns the local save contract for **Badminton Manager**.

Safety invariant:

$$
\text{invalid import} \Rightarrow \text{no active-save mutation}
$$

## Storage Layers And Keys

Portable gameplay state and browser slot metadata are deliberately separate:

```text
SaveSlotEnvelope v1
  -> slot identity + timestamps + revision + archive state
  -> PersistedSave v13
       -> tournament/live/career gameplay truth
```

`game/store/saveRepository.ts` owns the browser repository:

| Key pattern | Purpose |
| --- | --- |
| `badminton-manager-saves:active` | Active slot identifier only |
| `badminton-manager-saves:slot:<slotId>` | Validated storage-envelope version 1 plus portable save |
| `badminton-manager-saves:backup:<slotId>:<revision>` | Pre-overwrite checkpoint; newest two are retained |
| `badminton-manager-saves:quarantine:<slotId>:<id>` | Raw unreadable slot isolated from every healthy slot |
| `badminton-manager-save` | Legacy singleton source, migrated once after verified writes |
| `badminton-manager-save-corrupt` | Legacy singleton quarantine retained for compatibility |

There is no global slot manifest. Discovery enumerates matching keys so one damaged index cannot hide every career.
Settings and shell preferences use separate keys and are not gameplay saves.

## Current Save Versions

The portable top-level save version is `13`; its current career schema version is `11`. The storage envelope has its
own independent `storageVersion: 1`.

```ts
PersistedSave = {
  version: 13;
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  seed: number;
  tournament: TournamentState | null;
  liveMatch: LiveManagedMatch | null;
  career: CareerState | null; // version 11
};
```

`game/store/save.ts` accepts top-level versions `2` through `13`. Migration reaches the current portable shape before
repository writes, runtime hydration, or import confirmation.

## Repository Write Contract

Every slot mutation is read back byte-for-byte. Gameplay overwrite follows:

```text
validate current slot
  -> write + verify current revision as backup
  -> write + verify next revision
  -> restore prior raw slot if next write verification fails
  -> prune backups to newest two
```

Slot corruption is quarantined under that slot's identity and cannot delete or quarantine another slot. Renaming,
duplicating, archiving/restoring, permanent deletion, switching, and backup restoration are explicit store actions.
A backup restore is written as a new revision; the pre-restore current revision becomes the newest backup.

## Boot And Legacy Migration

`loadPersistedFromSaveRepository()` is the browser boot gate. It first attempts an idempotent singleton migration,
then loads the active healthy slot or the most recently played unarchived fallback.

Legacy migration follows a strict order:

1. Parse, validate, and migrate `badminton-manager-save` to version 13.
2. Create or reuse a byte-identical slot and verify its readback.
3. Write and verify the active pointer.
4. Only then remove the singleton source.

If cleanup fails, the verified slot is reused on retry rather than duplicated. Malformed legacy singleton data follows
the verified legacy quarantine path; if quarantine storage is unavailable, the source remains in place and the UI
reports recovery attention.

## Gameplay Migration Responsibilities

`migratePersistedSave()` owns portable schema migration. It currently:

- upgrades every supported career generation through ecosystem, tactics, infrastructure, universe, ranking,
  preparation, development, and season-lifecycle state;
- qualifies current events with `seasonId` and stable `templateId` without resetting generated future dates;
- derives season identifiers for legacy event, match, and achievement archives from their saved dates;
- initializes `seasonStartedAt` and an empty `seasonReviews` list without inventing a historical review;
- initializes a missing career world as an honest catalog snapshot at the saved season/date, with no invented prior
  progression, retirement, or intake log;
- hydrates honest `legacy_unavailable` universe evidence when precise old brackets do not exist;
- simulates overdue universe state through the saved date without overwriting played managed-match facts;
- normalizes legacy public tier labels, quick-tournament names, and missing archive sources;
- refreshes derived rankings and assistant advice after migration.

When the portable shape changes, add the prior current schema to the migration union, migrate directly to current,
add focused round-trip/idempotency tests, and update this reference.

## Import, Export, And Slot Operations

`validateImportedSaveText(raw)` performs JSON parse, supported-schema validation, migration, and final current-schema
validation. Preview is read-only. Confirming a valid preview creates a new slot; it never overwrites the active career.

Export remains portable JSON for the active `PersistedSave`, not a browser-specific envelope. Duplicate creates a new
slot identity from the same portable state. Archive is reversible. Permanent delete is separately confirmed and removes
only the selected slot and its rolling backups; quarantine evidence remains independently visible.

## What Must Never Happen

- An invalid import must not mutate any slot, pointer, backup, quarantine, or Zustand runtime state.
- A failed overwrite must not destroy the last verified current revision.
- Corruption in one slot must not affect another slot.
- A legacy singleton must not be removed before both migrated slot and active pointer verify.
- Backup restoration must not rewrite history in place; it creates a new revision.
- Migration must not fabricate unavailable brackets, matches, achievements, or season reviews.

## Verification Contract

At minimum, prove current and legacy round trips, singleton migration idempotency, slot isolation, bounded backups,
restore behavior, per-slot quarantine, failed write/readback recovery, import-to-new-slot safety, explicit archive/delete,
and accessible responsive Save Manager operations. Focused coverage lives in `tests/unit/save-migration.test.ts`,
`tests/unit/save-repository.test.ts`, and `tests/unit/save-store.test.ts`; browser proof lives under `e2e/`.

## Version 13 Season Lifecycle Migration

Version 13 / career 11 introduces `seasonStartedAt`, season-qualified event editions and archive records, and durable
`seasonReviews`. Migration from version 12 / career 10 preserves all saved dates and facts, derives only missing season
identity, starts with no fabricated review, and is idempotent. A finalized review is created only by the live career
resolver after every event is terminal and no managed match or scheduled preparation remains pending.

## Version 12 Preparation Migration

Version Two bumps the active shape to top-level version `12` and career version `10` because scheduled preparation intent and dated development history are canonical gameplay facts.

New career fields:

- `career.preparationSchedule`, containing exact versioned training-plan snapshots for pending blocks
- `career.developmentHistory`, containing career-start, recruitment, legacy, and resolved-preparation snapshots

Migration from version `11` / career `9` follows these rules:

- the pending schedule starts empty
- `selectedTrainingPlanId` is never converted into a scheduled block because it may represent assistant advice rather than completed training
- each current athlete receives one `legacy_snapshot` at the saved career date
- the snapshot preserves known current values while explicitly stating that earlier development events are unavailable
- migration uses no randomness and is idempotent

New careers receive a `career_start` baseline. Pending blocks preserve the full plan inputs plus `rulesVersion`, so later catalog tuning cannot rewrite a saved commitment.

## Version 11 Rolling Ranking Migration

TIX-023 bumps the active save shape to top-level version `11` and career version `9`.

New career fields:

- `career.rankingResults`
- `career.rankingSettings`
- extended cached `career.rankings` rows with counted-result metadata
- optional `fieldSnapshot` on universe event records

Migration rules:

- saves without `rankingResults` remain loadable
- old aggregate ranking rows are bridged with honest `legacy_snapshot` ranking rows
- dated old ranking history rows become `archive_import` ranking results when event/date evidence exists
- migration does not fabricate precise old brackets or pre-save match truth
- migrated saves rebuild `career.rankings` from the resulting ledger
- boot load and import preview both run migration before runtime hydration

`legacy_snapshot` rows are a compatibility bridge, not match history. They may support old-save continuity, but they must not masquerade as played tournament records in player profiles.
