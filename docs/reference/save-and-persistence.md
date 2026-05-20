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

The current top-level persisted save version is `10`.

The current career schema version inside a version-10 save is `8`.

`game/store/save.ts` supports legacy top-level versions `2` through `9` and migrates them to the current `PersistedSave` shape before hydration or import confirmation.

Current payload shape, simplified:

```ts
PersistedSave = {
  version: 10;
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  seed: number;
  tournament: TournamentState | null;
  liveMatch: LiveManagedMatch | null;
  career: CareerState | null;
};
```

## Boot Load Behavior

`loadPersistedFromStorage()` in `game/store/store.ts` is the boot-time local-storage gate.

Flow:

```text
read badminton-manager-save
  -> no value: clean default state
  -> malformed JSON: quarantine raw payload, clear active key, open safe default state
  -> schema invalid: quarantine raw payload, clear active key, open safe default state
  -> schema valid: migrate payload, infer phase, hydrate runtime state
```

Quarantine writes the raw invalid active save to `badminton-manager-save-corrupt` and removes `badminton-manager-save` so the app can boot safely.

## Migration Responsibilities

`migratePersistedSave()` in `game/store/save.ts` owns save migration.

Current responsibilities include:

- migrating legacy tournament-only saves to top-level version `10`
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

Boot-time corrupted active saves are different: the app quarantines the raw active payload, clears the active key, and opens safely because the active slot itself cannot be trusted.

## Test Expectations

When save shape, migration, import, or persistence behavior changes, tests should cover:

- current version round-trip through `persistedSaveSchema`
- all supported legacy versions that can still appear in user exports
- migration defaults for newly added required fields
- local boot quarantine for malformed JSON
- local boot quarantine for schema-invalid active saves
- import preview of valid current and legacy saves
- malformed import rejection without active/corrupt key mutation
- schema-invalid import rejection without active/corrupt key mutation
- active save deletion and corrupt backup deletion as separate actions
- legacy label/name/source normalization when affected

The focused file today is `tests/unit/save-migration.test.ts`; browser proof for the Save Manager lives in `e2e/app.spec.ts`.
