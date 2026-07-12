import { useMemo, useState } from "react";
import { playerMap } from "../game/content/players";
import type { SaveRecoveryNotice } from "../game/store/store";
import { CORRUPT_STORAGE_KEY, STORAGE_KEY } from "../game/store/store";
import {
  CURRENT_SAVE_VERSION,
  validateImportedSaveText,
  type PersistedSave,
  type SaveImportValidationResult
} from "../game/store/save";
import type { SaveSlotEnvelope } from "../game/store/saveRepository";
import { useModalFocus } from "./useModalFocus";

interface SaveManagerViewProps {
  saveSlots: SaveSlotEnvelope[];
  activeSaveSlotId: string | null;
  quarantinedSlotCount: number;
  quarantinedSlotCounts: Record<string, number>;
  saveBackupCounts: Record<string, number>;
  corruptSavePresent: boolean;
  saveRecovery: SaveRecoveryNotice | null;
  onContinueLocalSave: () => void;
  onSwitchSaveSlot: (slotId: string) => void;
  onRenameSaveSlot: (slotId: string, name: string) => void;
  onArchiveSaveSlot: (slotId: string) => void;
  onRestoreLatestSaveBackup: (slotId: string) => void;
  onCreateEmptySaveSlot: (name?: string) => void;
  onImportSaveAsSlot: (save: PersistedSave, name?: string) => void;
  onDuplicateSaveSlot: (slotId: string, name?: string) => void;
  onDeleteSaveSlot: (slotId: string) => void;
  onExportSave: () => PersistedSave | null;
  onDeleteLegacySource: () => boolean;
  onDeleteCorruptSave: () => void;
}

type PendingConfirmation =
  | { kind: "archive" | "restore-backup" | "delete-slot"; slotId: string; slotName: string }
  | { kind: "delete-corrupt" | "delete-legacy-source" }
  | null;

interface SaveSummary {
  mode: string;
  headline: string;
  detail: string;
}

function playerName(playerId: string) {
  return playerMap[playerId]?.name ?? playerId;
}

function summarizeSave(save: PersistedSave): SaveSummary {
  if (save.career) {
    const athlete = playerName(save.career.program.managedPlayerId);
    return {
      mode: "Career",
      headline: athlete,
      detail: `${save.career.date} · ${save.career.stage.replaceAll("_", " ")}`
    };
  }

  if (save.liveMatch) {
    return {
      mode: "Live match",
      headline: `${playerName(save.selectedPlayerId)} vs ${save.liveMatch.opponentName}`,
      detail: `${save.liveMatch.roundName} in progress`
    };
  }

  if (save.tournament) {
    return {
      mode: "Tournament",
      headline: save.tournament.name,
      detail: `${playerName(save.selectedPlayerId)} · ${save.tournament.tier}`
    };
  }

  return {
    mode: "New career",
    headline: "Setup not completed",
    detail: `Ready to select a managed athlete · seed ${save.seed}`
  };
}

function formatTimestamp(timestamp: string) {
  const value = new Date(timestamp);
  if (Number.isNaN(value.getTime())) {
    return timestamp;
  }

  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}

function importStatusText(result: SaveImportValidationResult | null) {
  if (!result) {
    return "Paste JSON or choose a file. Validation happens before a new career slot is created.";
  }

  if (result.ok) {
    return "Validated and migrated. Confirming creates a new slot; no existing career is overwritten.";
  }

  return result.message;
}

function confirmationCopy(confirmation: Exclude<PendingConfirmation, null>) {
  if (confirmation.kind === "archive") {
    return {
      title: `Archive ${confirmation.slotName}?`,
      body: "The career stays on this device and can be restored later. If it is active, another live slot becomes active.",
      action: "Archive Career"
    };
  }

  if (confirmation.kind === "restore-backup") {
    return {
      title: `Restore the latest backup for ${confirmation.slotName}?`,
      body: "The current revision is preserved as a backup before the earlier save is restored, so the operation remains recoverable.",
      action: "Restore Latest Backup"
    };
  }

  if (confirmation.kind === "delete-slot") {
    return {
      title: `Permanently delete ${confirmation.slotName}?`,
      body: "This removes the career slot and every local revision backup for it. This cannot be undone in the app. Isolated quarantine records remain reported separately.",
      action: "Permanently Delete"
    };
  }

  if (confirmation.kind === "delete-legacy-source") {
    return {
      title: "Clear unreadable legacy source?",
      body: `This removes only ${STORAGE_KEY}. It is offered because the invalid legacy source could not be migrated into a career slot.`,
      action: "Clear Legacy Source"
    };
  }

  return {
    title: "Delete quarantined legacy backup?",
    body: `This removes only ${CORRUPT_STORAGE_KEY}. Named career slots and their revision backups are not changed.`,
    action: "Delete Legacy Backup"
  };
}

interface SaveSlotCardProps {
  slot: SaveSlotEnvelope;
  active: boolean;
  backupCount: number;
  quarantineCount: number;
  editing: boolean;
  renameDraft: string;
  onRenameDraftChange: (name: string) => void;
  onBeginRename: () => void;
  onCancelRename: () => void;
  onSaveRename: () => void;
  onContinue: () => void;
  onSwitch: () => void;
  onArchive: () => void;
  onRestoreArchived: () => void;
  onRestoreBackup: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SaveSlotCard(props: SaveSlotCardProps) {
  const summary = summarizeSave(props.slot.save);
  const archived = props.slot.archivedAt !== null;
  const headingId = `save-slot-${props.slot.slotId}`;

  return (
    <article className={`save-career-card${props.active ? " save-career-card-active" : ""}`} aria-labelledby={headingId}>
      <div className="save-career-card-heading">
        <div>
          <span className="save-career-mode">{summary.mode}</span>
          <h3 id={headingId}>{props.slot.name}</h3>
        </div>
        <div className="save-career-badges" aria-label="Slot status">
          {props.active && <span className="chip chip-primary">Active</span>}
          {archived && <span className="chip">Archived</span>}
        </div>
      </div>

      <div className="save-career-identity">
        <strong>{summary.headline}</strong>
        <span>{summary.detail}</span>
      </div>

      <dl className="save-career-trust-grid">
        <div>
          <dt>Last played</dt>
          <dd>{formatTimestamp(props.slot.lastPlayedAt)}</dd>
        </div>
        <div>
          <dt>Revision</dt>
          <dd>r{props.slot.revision}</dd>
        </div>
        <div>
          <dt>Schema</dt>
          <dd>Save v{props.slot.save.version}</dd>
        </div>
        <div>
          <dt>Verified backups</dt>
          <dd>{props.backupCount}</dd>
        </div>
        <div>
          <dt>Quarantined records</dt>
          <dd>{props.quarantineCount}</dd>
        </div>
      </dl>

      {props.editing ? (
        <form
          className="save-rename-form"
          onSubmit={(event) => {
            event.preventDefault();
            props.onSaveRename();
          }}
        >
          <label htmlFor={`rename-${props.slot.slotId}`}>Career name</label>
          <input
            id={`rename-${props.slot.slotId}`}
            value={props.renameDraft}
            onChange={(event) => props.onRenameDraftChange(event.target.value)}
            autoFocus
          />
          <div className="save-action-row">
            <button className="command-button command-button-secondary" type="button" onClick={props.onCancelRename}>
              Cancel
            </button>
            <button className="command-button command-button-primary" type="submit" disabled={!props.renameDraft.trim()}>
              Save Name
            </button>
          </div>
        </form>
      ) : (
        <div className="save-career-actions">
          {!archived && props.active && (
            <button className="command-button command-button-primary" type="button" onClick={props.onContinue}>
              Continue
            </button>
          )}
          {!archived && !props.active && (
            <button className="command-button command-button-primary" type="button" onClick={props.onSwitch}>
              Switch to Career
            </button>
          )}
          {archived && (
            <button className="command-button command-button-primary" type="button" onClick={props.onRestoreArchived}>
              Restore Career
            </button>
          )}
          <button className="command-button command-button-secondary" type="button" onClick={props.onBeginRename}>
            Rename
          </button>
          <button className="command-button command-button-secondary" type="button" onClick={props.onDuplicate}>
            Duplicate
          </button>
          {!archived && (
            <button className="command-button command-button-secondary" type="button" onClick={props.onArchive}>
              Archive
            </button>
          )}
          <button
            className="command-button command-button-secondary"
            type="button"
            onClick={props.onRestoreBackup}
            disabled={props.backupCount === 0 || archived}
            aria-label={`Restore latest backup for ${props.slot.name}`}
          >
            Restore Latest Backup
          </button>
          <button className="command-button command-button-danger" type="button" onClick={props.onDelete}>
            Permanently Delete
          </button>
        </div>
      )}
    </article>
  );
}

export function SaveManagerView(props: SaveManagerViewProps) {
  const [importText, setImportText] = useState("");
  const [importName, setImportName] = useState("");
  const [importResult, setImportResult] = useState<SaveImportValidationResult | null>(null);
  const [newSlotName, setNewSlotName] = useState("");
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation>(null);
  const { modalRef, handleModalKeyDown } = useModalFocus(
    pendingConfirmation !== null,
    () => setPendingConfirmation(null)
  );
  const liveSlots = useMemo(() => props.saveSlots.filter((slot) => slot.archivedAt === null), [props.saveSlots]);
  const archivedSlots = useMemo(() => props.saveSlots.filter((slot) => slot.archivedAt !== null), [props.saveSlots]);

  function previewImport(raw = importText) {
    const result = validateImportedSaveText(raw);
    setImportResult(result);
    setNotice(result.ok ? "Import preview ready. Existing careers are unchanged." : result.message);
  }

  function handleImportFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      setImportText(raw);
      previewImport(raw);
    };
    reader.readAsText(file);
  }

  function exportSave() {
    const save = props.onExportSave();
    if (!save) {
      setNotice("Select a live career before exporting.");
      return;
    }

    const blob = new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `badminton-manager-save-v${save.version}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Portable JSON exported from the active career.");
  }

  function confirmImport() {
    if (!importResult?.ok) {
      return;
    }

    props.onImportSaveAsSlot(importResult.save, importName.trim() || undefined);
    setNotice("Imported save created as a new active career slot. No existing career was overwritten.");
    setImportResult(null);
    setImportText("");
    setImportName("");
  }

  function confirmPendingAction() {
    if (!pendingConfirmation) {
      return;
    }

    if (pendingConfirmation.kind === "archive") {
      props.onArchiveSaveSlot(pendingConfirmation.slotId);
      setNotice(`${pendingConfirmation.slotName} archived. Its local save remains available under Archived careers.`);
    } else if (pendingConfirmation.kind === "restore-backup") {
      props.onRestoreLatestSaveBackup(pendingConfirmation.slotId);
      setNotice(`Latest verified backup restored for ${pendingConfirmation.slotName}. The prior current revision was backed up first.`);
    } else if (pendingConfirmation.kind === "delete-slot") {
      props.onDeleteSaveSlot(pendingConfirmation.slotId);
      setNotice(`${pendingConfirmation.slotName} and its local revision backups were permanently deleted. Per-slot quarantine records remain separately retained.`);
    } else if (pendingConfirmation.kind === "delete-corrupt") {
      props.onDeleteCorruptSave();
      setNotice("Legacy quarantined backup deleted. Named career slots were not changed.");
    } else {
      const cleared = props.onDeleteLegacySource();
      setNotice(cleared
        ? "Unreadable legacy source cleared. Named career slots were not changed."
        : "The browser did not allow the legacy source to be cleared. It remains preserved; named career slots were not changed.");
    }

    setPendingConfirmation(null);
  }

  function beginRename(slot: SaveSlotEnvelope) {
    setEditingSlotId(slot.slotId);
    setRenameDraft(slot.name);
  }

  function renderSlot(slot: SaveSlotEnvelope) {
    return (
      <SaveSlotCard
        key={slot.slotId}
        slot={slot}
        active={slot.slotId === props.activeSaveSlotId}
        backupCount={props.saveBackupCounts[slot.slotId] ?? 0}
        quarantineCount={props.quarantinedSlotCounts[slot.slotId] ?? 0}
        editing={editingSlotId === slot.slotId}
        renameDraft={renameDraft}
        onRenameDraftChange={setRenameDraft}
        onBeginRename={() => beginRename(slot)}
        onCancelRename={() => setEditingSlotId(null)}
        onSaveRename={() => {
          const name = renameDraft.trim();
          if (!name) {
            return;
          }
          props.onRenameSaveSlot(slot.slotId, name);
          setEditingSlotId(null);
          setNotice(`Career renamed to ${name}.`);
        }}
        onContinue={props.onContinueLocalSave}
        onSwitch={() => {
          props.onSwitchSaveSlot(slot.slotId);
          setNotice(`${slot.name} is now the active career.`);
        }}
        onArchive={() => setPendingConfirmation({ kind: "archive", slotId: slot.slotId, slotName: slot.name })}
        onRestoreArchived={() => {
          props.onArchiveSaveSlot(slot.slotId);
          setNotice(`${slot.name} restored to the live career list. Switch to it when ready.`);
        }}
        onRestoreBackup={() => setPendingConfirmation({ kind: "restore-backup", slotId: slot.slotId, slotName: slot.name })}
        onDuplicate={() => {
          props.onDuplicateSaveSlot(slot.slotId);
          setNotice(`${slot.name} duplicated as a new isolated active career.`);
        }}
        onDelete={() => setPendingConfirmation({ kind: "delete-slot", slotId: slot.slotId, slotName: slot.name })}
      />
    );
  }

  const confirmation = pendingConfirmation ? confirmationCopy(pendingConfirmation) : null;

  return (
    <section className="screen-shell save-manager-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Save Manager</p>
          <h1 className="screen-title">Local Career Library</h1>
          <p className="screen-copy">
            Named career slots, verified revision backups, portable JSON, and isolated recovery records—all on this device.
          </p>
        </div>
        <div className="screen-meta">
          <span>{liveSlots.length} live {liveSlots.length === 1 ? "career" : "careers"}</span>
          <span>{archivedSlots.length} archived</span>
        </div>
      </div>

      <section className="management-status-strip save-library-status" aria-label="Local save library status">
        <div><span>Active career</span><strong>{props.activeSaveSlotId ? "Selected" : "None"}</strong></div>
        <div><span>Live careers</span><strong>{liveSlots.length}</strong></div>
        <div><span>Archived careers</span><strong>{archivedSlots.length}</strong></div>
        <div><span>Quarantine records</span><strong>{props.quarantinedSlotCount}</strong></div>
        <div><span>Portable format</span><strong>Save v{CURRENT_SAVE_VERSION}</strong></div>
      </section>

      {props.saveRecovery && (
        <section className="start-recovery-strip save-recovery-strip" role="alert" aria-live="assertive">
          <div>
            <strong>{props.saveRecovery.disposition === "quarantined" ? "Legacy save quarantined safely." : "Unreadable legacy source preserved."}</strong>
            <span>{props.saveRecovery.message}</span>
          </div>
          <span className="chip">Stored at {props.saveRecovery.backupKey}</span>
        </section>
      )}

      <div className="save-library-layout">
        <main className="save-library-main">
          <section className="command-panel" aria-labelledby="live-careers-heading">
            <div className="panel-header">
              <div>
                <h2 id="live-careers-heading">Live careers</h2>
                <p className="panel-summary panel-summary-tight">Switching loads one career at a time. Every slot keeps its own identity, revisions, and recovery history.</p>
              </div>
              <button className="command-button command-button-secondary" type="button" onClick={exportSave} disabled={!props.activeSaveSlotId}>
                Export Active JSON
              </button>
            </div>
            {liveSlots.length > 0 ? (
              <div className="save-career-list">{liveSlots.map(renderSlot)}</div>
            ) : (
              <div className="save-library-empty" role="status">
                <strong>No live careers</strong>
                <p>Create a clean slot or restore an archived career. Nothing has been deleted.</p>
              </div>
            )}
          </section>

          {archivedSlots.length > 0 && (
            <section className="command-panel" aria-labelledby="archived-careers-heading">
              <div className="panel-header">
                <div>
                  <h2 id="archived-careers-heading">Archived careers</h2>
                  <p className="panel-summary panel-summary-tight">Archived saves remain stored locally and can return to the live list without data loss.</p>
                </div>
                <span>{archivedSlots.length} retained</span>
              </div>
              <div className="save-career-list">{archivedSlots.map(renderSlot)}</div>
            </section>
          )}
        </main>

        <aside className="save-library-tools" aria-label="Create and import careers">
          <section className="command-panel">
            <div className="panel-header">
              <div>
                <h2>Create Career Slot</h2>
                <p className="panel-summary panel-summary-tight">Opens a clean setup state in a new named slot.</p>
              </div>
              <span>No overwrite</span>
            </div>
            <form
              className="save-create-form"
              onSubmit={(event) => {
                event.preventDefault();
                props.onCreateEmptySaveSlot(newSlotName.trim() || undefined);
                setNotice("New empty career slot created and selected.");
                setNewSlotName("");
              }}
            >
              <label htmlFor="new-save-slot-name">Career name <span>(optional)</span></label>
              <input id="new-save-slot-name" value={newSlotName} onChange={(event) => setNewSlotName(event.target.value)} placeholder="e.g. Singapore Project" />
              <button className="command-button command-button-primary" type="submit">Create Empty Career</button>
            </form>
          </section>

          <section className="command-panel save-import-panel">
            <div className="panel-header">
              <div>
                <h2>Import as New Career</h2>
                <p className="panel-summary panel-summary-tight">{importStatusText(importResult)}</p>
              </div>
              <span>{importResult?.ok ? "Ready" : "No write"}</span>
            </div>

            <label className="browse-field save-file-field">
              <span>Choose JSON file</span>
              <input type="file" accept="application/json,.json" aria-label="Import save JSON file" onChange={(event) => handleImportFile(event.currentTarget.files?.[0])} />
            </label>
            <label className="browse-field save-import-textarea">
              <span>Paste JSON</span>
              <textarea
                aria-label="Import save JSON"
                value={importText}
                onChange={(event) => {
                  setImportText(event.target.value);
                  setImportResult(null);
                }}
                placeholder={`{"version": ${CURRENT_SAVE_VERSION}, ... }`}
              />
            </label>
            <label className="save-import-name" htmlFor="import-save-name">
              New career name <span>(optional)</span>
            </label>
            <input id="import-save-name" value={importName} onChange={(event) => setImportName(event.target.value)} placeholder="Imported career" />
            <div className="save-action-row">
              <button className="command-button command-button-secondary" type="button" onClick={() => previewImport()} disabled={!importText.trim()}>Preview Import</button>
              <button className="command-button command-button-primary" type="button" onClick={confirmImport} disabled={!importResult?.ok}>Import as New Slot</button>
            </div>

            {importResult?.ok && (
              <div className="import-preview-box" role="status" aria-live="polite">
                <span>{summarizeSave(importResult.save).mode}</span>
                <strong>{summarizeSave(importResult.save).headline}</strong>
                <p>{summarizeSave(importResult.save).detail}</p>
              </div>
            )}
            {importResult && !importResult.ok && (
              <div className="import-error-box" role="alert">
                <strong>{importResult.reason === "malformed_json" ? "Malformed JSON" : "Schema invalid"}</strong>
                <p>{importResult.message}</p>
                {importResult.issues && <ul>{importResult.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
              </div>
            )}
          </section>

          {(props.corruptSavePresent || props.saveRecovery) && (
            <section className="command-panel save-legacy-recovery-panel" aria-labelledby="legacy-recovery-heading">
              <div className="panel-header">
                <div>
                  <h2 id="legacy-recovery-heading">Legacy Recovery</h2>
                  <p className="panel-summary panel-summary-tight">These controls affect only pre-library recovery keys, never named career slots.</p>
                </div>
              </div>
              <div className="save-career-actions">
                {props.saveRecovery?.disposition === "source_preserved" && (
                  <button className="command-button command-button-secondary" type="button" onClick={() => setPendingConfirmation({ kind: "delete-legacy-source" })}>Clear Unreadable Legacy Source</button>
                )}
                <button className="command-button command-button-secondary" type="button" onClick={() => setPendingConfirmation({ kind: "delete-corrupt" })} disabled={!props.corruptSavePresent}>Delete Legacy Quarantine Backup</button>
              </div>
            </section>
          )}
        </aside>
      </div>

      {confirmation && (
        <div className="modal-backdrop" role="presentation">
          <section
            ref={modalRef}
            className="save-confirmation"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="save-confirmation-title"
            aria-describedby="save-confirmation-copy"
            tabIndex={-1}
            onKeyDown={handleModalKeyDown}
          >
            <div>
              <strong id="save-confirmation-title">{confirmation.title}</strong>
              <p id="save-confirmation-copy">{confirmation.body}</p>
            </div>
            <div className="save-action-row">
              <button className="command-button command-button-secondary" type="button" onClick={() => setPendingConfirmation(null)}>Cancel</button>
              <button className="command-button command-button-primary" type="button" onClick={confirmPendingAction}>{confirmation.action}</button>
            </div>
          </section>
        </div>
      )}

      {notice && <p className="save-manager-notice" role="status" aria-live="polite">{notice}</p>}
    </section>
  );
}
