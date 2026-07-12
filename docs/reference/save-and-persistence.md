# Save And Persistence Reference

This document owns the local save contract for **Badminton Manager**.

Safety invariant:

$$
\text{invalid import} \Rightarrow \text{no active-save mutation}
$$

## Storage Keys

Current keys live in `game/store/store.ts`:

| Key | Purpose |
| --- | --- |
| `badminton-manager-save` | Single active local save slot |
| `badminton-manager-save-corrupt` | Quarantined raw active-save payload when boot finds malformed JSON or an unsupported schema |

Settings and shell preferences use separate local-storage keys and are not part of the gameplay save schema.

## Current Save Versions

The current top-level persisted save version is `11`.

The current career schema version inside a version-11 save is `9`.

`game/store/save.ts` supports legacy top-level versions `2` through `10` and migrates them to the current `PersistedSave` shape before hydration or import confirmation.

Current payload shape, simplified:

```ts
PersistedSave = {
  version: 11;
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  seed: number;
  tournament: TournamentState | null;
  liveMatch: LiveManagedMatch | null;
  career: CareerState | null;
};
```

`MatchTactic` may contain an optional version-1 `advancedIntent` snapshot for career matches. The field carries exact tactic sliders, rally intent, and modules through active-match saves. It remains optional so old version-11 mid-match saves and compact quick/autoplay tactics load without a top-level save-version bump. JSON round-trip tests verify that a resumed exact-intent session produces the same next deterministic point.

## Boot Load Behavior

`loadPersistedFromStorage()` in `game/store/store.ts` is the boot-time local-storage gate.

Flow:

```text
read badminton-manager-save
  -> no value: clean default state
  -> malformed JSON: verify quarantine write, then clear active key and open safe state
  -> schema invalid: verify quarantine write, then clear active key and open safe state
  -> quarantine unavailable: preserve the original active key and expose recovery attention
  -> schema valid: migrate payload, infer phase, hydrate runtime state
```

Quarantine writes the raw invalid active save to `badminton-manager-save-corrupt`, reads it back, and only then attempts to remove `badminton-manager-save`. If the backup write fails or cannot be verified, the original active entry is preserved in place. The runtime does not hydrate the invalid payload, but Save Manager names the preserved source and leaves it available for explicit deletion or future recovery tooling.

## Migration Responsibilities

`migratePersistedSave()` in `game/store/save.ts` owns save migration.

Current responsibilities include:

- migrating legacy tournament-only saves to top-level version `11`
- upgrading career versions through ecosystem, rivals, tactics, facilities/media, event history, match history, player achievements, universe event records, and tactical-viewer defaults
- defaulting missing `career.universeEvents` to `[]` before runtime hydration
- hydrating career events from the current fictional catalog
- hydrating old event-history rows into universe records when complete bracket evidence exists, or `legacy_unavailable` when it does not
- running `simulateUniverseThroughDate()` through the saved career date during load/import so overdue non-managed events gain deterministic universe records without waiting for React routes to open
- preserving played managed-match facts during load/import simulation; entered overdue events with only partial played evidence remain incomplete rather than receiving fabricated brackets
- normalizing legacy public tier labels to fictional `Circuit` labels
- normalizing legacy quick-tournament names to `Harborline Open`
- defaulting legacy match-history rows without source metadata to `archive_import`
- refreshing assistant advice after career migration

When the save shape changes:

1. Add or extend the schema in `game/store/save.ts` or `game/career/models.ts`.
2. Migrate old versions without assuming users have intermediate saves.
3. Preserve the ability to import valid old JSON.
4. Add focused migration tests in `tests/unit/save-migration.test.ts`.
5. Update this document and any affected subsystem reference.

## Import Validation

Import preview is intentionally separate from import confirmation.

`validateImportedSaveText(raw)` performs:

```text
JSON.parse
  -> persistedSavePayloadSchema.safeParse
  -> migratePersistedSave
  -> persistedSaveSchema.safeParse
  -> return preview save or validation error
```

It does not write to local storage. It does not delete the active save. It does not delete a corrupt backup.

`components/SaveManagerView.tsx` stores the preview result in component state and only calls `onConfirmImport` after the user confirms a valid preview.

`replaceActiveSave(save)` in `game/store/store.ts` is the active overwrite point. It writes the migrated save to `badminton-manager-save` and updates runtime state from that save.

## Preview And Confirm Behavior

Save Manager behavior:

- Paste or file-select JSON.
- Preview parses, validates, migrates, and summarizes the save.
- Invalid previews show an error and leave local storage untouched.
- Valid previews show metadata before overwrite.
- Confirm import writes the migrated save to the active slot.
- Export creates portable pretty-printed JSON from the current runtime save payload.

This separation is required because a user may paste malformed JSON while still relying on the current active save.

## Deletion Behavior

### Active Save Deletion

`deleteActiveSave()` removes only `badminton-manager-save`, resets runtime state to a clean launch slot, and keeps any corrupt backup flag if `badminton-manager-save-corrupt` still exists.

### Corrupt Backup Deletion

`deleteCorruptSave()` removes only `badminton-manager-save-corrupt`, clears the recovery notice, and marks quarantine as absent.

Deleting a corrupt backup must not delete the active save. Deleting the active save must not silently delete the corrupt backup.

## What Must Never Happen

Malformed or schema-invalid imports must never:

- overwrite `badminton-manager-save`
- delete `badminton-manager-save`
- overwrite `badminton-manager-save-corrupt`
- delete `badminton-manager-save-corrupt`
- mutate the live Zustand state
- move the app into a migrated preview as if it had been confirmed

Boot-time corrupted active saves are different: the app hydrates a safe runtime state because the payload cannot be trusted. It may clear the active key only after a byte-for-byte quarantine copy has been verified. If backup storage is unavailable, preserving the original entry takes precedence over clearing the broken slot.

## Test Expectations

When save shape, migration, import, or persistence behavior changes, tests should cover:

- current version round-trip through `persistedSaveSchema`
- all supported legacy versions that can still appear in user exports
- migration defaults for newly added required fields
- local boot quarantine for malformed JSON
- local boot quarantine for schema-invalid active saves
- quarantine-write failure preserving the original active payload
- import preview of valid current and legacy saves
- malformed import rejection without active/corrupt key mutation
- schema-invalid import rejection without active/corrupt key mutation
- active save deletion and corrupt backup deletion as separate actions
- legacy label/name/source normalization when affected

The focused file today is `tests/unit/save-migration.test.ts`; browser proof for the Save Manager lives in `e2e/app.spec.ts`.

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
