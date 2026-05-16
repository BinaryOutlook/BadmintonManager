import { useMemo, useState } from "react";
import { playerMap } from "../game/content/players";
import type { CareerState } from "../game/career/models";
import type { AppPhase, TacticKey } from "../game/store/store";
import { CORRUPT_STORAGE_KEY, STORAGE_KEY } from "../game/store/store";
import type { PersistedSave } from "../game/store/save";
import { validateImportedSaveText, type SaveImportValidationResult } from "../game/store/save";
import type { TournamentState } from "../game/tournament/tournament";

interface SaveManagerViewProps {
  activeSavePresent: boolean;
  corruptSavePresent: boolean;
  phase: AppPhase;
  selectedPlayerId: string;
  plannedTacticKey: TacticKey;
  seed: number;
  tournament: TournamentState | null;
  liveMatchActive: boolean;
  career: CareerState | null;
  onContinueLocalSave: () => void;
  onContinueCareer: () => void;
  onStartTournament: () => void;
  onStartNewCareer: () => void;
  onExportSave: () => PersistedSave | null;
  onConfirmImport: (save: PersistedSave) => void;
  onDeleteActiveSave: () => void;
  onDeleteCorruptSave: () => void;
}

type PendingDanger = "delete-active" | "delete-corrupt" | null;

interface SaveSummary {
  mode: string;
  headline: string;
  detail: string;
  rows: Array<{ label: string; value: string }>;
}

function playerName(playerId: string) {
  return playerMap[playerId]?.name ?? playerId;
}

function summarizeSave(save: PersistedSave): SaveSummary {
  if (save.career) {
    const athlete = playerName(save.career.program.managedPlayerId);

    return {
      mode: "Career save",
      headline: `${athlete} program`,
      detail: `${save.career.date} / ${save.career.stage.replace("_", " ")}`,
      rows: [
        { label: "Top version", value: String(save.version) },
        { label: "Career version", value: String(save.career.version) },
        { label: "Managed athlete", value: athlete },
        { label: "Cash", value: `$${save.career.economy.cash.toLocaleString()}` },
        { label: "Events entered", value: String(save.career.enteredEventIds.length) },
        { label: "Storage key", value: STORAGE_KEY }
      ]
    };
  }

  if (save.liveMatch) {
    return {
      mode: "Live tournament save",
      headline: `${playerName(save.selectedPlayerId)} vs ${save.liveMatch.opponentName}`,
      detail: `${save.liveMatch.roundName} in progress`,
      rows: [
        { label: "Top version", value: String(save.version) },
        { label: "Selected athlete", value: playerName(save.selectedPlayerId) },
        { label: "Tactic", value: save.plannedTacticKey },
        { label: "Round", value: save.liveMatch.roundName },
        { label: "Storage key", value: STORAGE_KEY }
      ]
    };
  }

  if (save.tournament) {
    return {
      mode: "Tournament save",
      headline: save.tournament.name,
      detail: `${playerName(save.selectedPlayerId)} / ${save.tournament.tier}`,
      rows: [
        { label: "Top version", value: String(save.version) },
        { label: "Selected athlete", value: playerName(save.selectedPlayerId) },
        { label: "Tactic", value: save.plannedTacticKey },
        { label: "Current round", value: save.tournament.rounds[save.tournament.currentRoundIndex]?.name ?? "Pending" },
        { label: "Storage key", value: STORAGE_KEY }
      ]
    };
  }

  return {
    mode: "Setup save",
    headline: `${playerName(save.selectedPlayerId)} ready`,
    detail: "Athlete and tactic selection only",
    rows: [
      { label: "Top version", value: String(save.version) },
      { label: "Selected athlete", value: playerName(save.selectedPlayerId) },
      { label: "Tactic", value: save.plannedTacticKey },
      { label: "Seed", value: String(save.seed) },
      { label: "Storage key", value: STORAGE_KEY }
    ]
  };
}

function summarizeRuntime(props: SaveManagerViewProps): SaveSummary {
  if (!props.activeSavePresent) {
    return {
      mode: "Empty slot",
      headline: "No active local save",
      detail: "Start Tournament or Start Career to write the single local slot.",
      rows: [
        { label: "Active key", value: STORAGE_KEY },
        { label: "Corrupt key", value: CORRUPT_STORAGE_KEY },
        { label: "Current athlete", value: playerName(props.selectedPlayerId) },
        { label: "Current tactic", value: props.plannedTacticKey }
      ]
    };
  }

  if (props.liveMatchActive) {
    return {
      mode: props.career ? "Live career save" : "Live tournament save",
      headline: "Match in progress",
      detail: `${props.phase} phase loaded from the active slot.`,
      rows: [
        { label: "Top version", value: "9" },
        ...(props.career
          ? [
              { label: "Career version", value: String(props.career.version) },
              { label: "Managed athlete", value: playerName(props.career.program.managedPlayerId) }
            ]
          : []),
        { label: "Selected athlete", value: playerName(props.selectedPlayerId) },
        { label: "Tactic", value: props.plannedTacticKey },
        { label: "Storage key", value: STORAGE_KEY },
        { label: "Corrupt key", value: CORRUPT_STORAGE_KEY }
      ]
    };
  }

  return summarizeSave({
    version: 9,
    selectedPlayerId: props.selectedPlayerId,
    plannedTacticKey: props.plannedTacticKey,
    seed: props.seed,
    tournament: props.tournament,
    liveMatch: null,
    career: props.career
  });
}

function importStatusText(result: SaveImportValidationResult | null) {
  if (!result) {
    return "Paste JSON or choose a file, then preview it before confirming overwrite.";
  }

  if (result.ok) {
    return "Import parsed, validated, and migrated. Review the preview before replacing the active slot.";
  }

  return result.message;
}

export function SaveManagerView(props: SaveManagerViewProps) {
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<SaveImportValidationResult | null>(null);
  const [notice, setNotice] = useState("");
  const [pendingDanger, setPendingDanger] = useState<PendingDanger>(null);
  const activeSummary = useMemo(() => summarizeRuntime(props), [props]);
  const previewSummary = importResult?.ok ? summarizeSave(importResult.save) : null;
  const managedAthleteName = props.career ? playerName(props.career.program.managedPlayerId) : "No career athlete";
  const saveVersion =
    activeSummary.rows.find((row) => row.label === "Top version")?.value ??
    activeSummary.rows.find((row) => row.label === "Save version")?.value ??
    "8";

  function previewImport(raw = importText) {
    const result = validateImportedSaveText(raw);
    setImportResult(result);
    setNotice(result.ok ? "Import preview ready. Nothing has been overwritten." : result.message);
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
      setNotice("No active local save is available to export.");
      return;
    }

    const json = JSON.stringify(save, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `badminton-manager-save-v${save.version}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Export JSON prepared from the current migrated local slot.");
  }

  function confirmImport() {
    if (!importResult?.ok) {
      return;
    }

    props.onConfirmImport(importResult.save);
    setNotice("Imported save confirmed and written to the active local slot.");
    setImportResult(null);
    setImportText("");
  }

  function confirmDanger() {
    if (pendingDanger === "delete-active") {
      props.onDeleteActiveSave();
      setNotice("Active local save deleted. The app is back on a clean launch slot.");
    }

    if (pendingDanger === "delete-corrupt") {
      props.onDeleteCorruptSave();
      setNotice("Quarantined save backup deleted.");
    }

    setPendingDanger(null);
  }

  return (
    <section className="screen-shell save-manager-page">
      <div className="screen-header">
        <div>
          <p className="screen-kicker">Save Manager</p>
          <h1 className="screen-title">Local Save Control</h1>
          <p className="screen-copy">
            One active browser slot, portable JSON export, validation before import, and explicit recovery controls.
          </p>
        </div>
        <div className="screen-meta">
          <span>{props.activeSavePresent ? "Active slot present" : "Active slot empty"}</span>
          <span>{props.corruptSavePresent ? "Quarantine present" : "No quarantine"}</span>
        </div>
      </div>

      <section className="management-status-strip save-status-strip" aria-label="Active save slot metadata">
        <div>
          <span>Slot</span>
          <strong>{props.activeSavePresent ? "Active local slot" : "Empty local slot"}</strong>
        </div>
        <div>
          <span>Mode</span>
          <strong>{activeSummary.mode}</strong>
        </div>
        <div>
          <span>Managed athlete</span>
          <strong>{managedAthleteName}</strong>
        </div>
        <div>
          <span>Save version</span>
          <strong>v{saveVersion}</strong>
        </div>
        <div>
          <span>Import preview</span>
          <strong>{previewSummary ? "Ready" : importResult && !importResult.ok ? "Rejected" : "Empty"}</strong>
        </div>
        <div>
          <span>Quarantine</span>
          <strong>{props.corruptSavePresent ? "Present" : "Clear"}</strong>
        </div>
      </section>

      <div className="save-manager-grid">
        <section className="command-panel save-slot-panel">
          <div className="panel-header">
            <div>
              <h2>Active Local Slot</h2>
              <p className="panel-summary panel-summary-tight">{activeSummary.detail}</p>
            </div>
            <span className="chip chip-primary">{activeSummary.mode}</span>
          </div>
          <h3 className="save-slot-headline">{activeSummary.headline}</h3>
          <div className="save-metadata-grid">
            {activeSummary.rows.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className="save-action-grid">
            <button className="command-button command-button-primary" type="button" onClick={props.onContinueCareer} disabled={!props.career}>
              Continue Career
            </button>
            <button className="command-button command-button-secondary" type="button" onClick={props.onContinueLocalSave} disabled={!props.activeSavePresent}>
              Continue Local Save
            </button>
            <button className="command-button command-button-secondary" type="button" onClick={exportSave} disabled={!props.activeSavePresent}>
              Export JSON
            </button>
            <button className="command-button command-button-secondary" type="button" onClick={props.onStartTournament}>
              Start Tournament
            </button>
            <button className="command-button command-button-secondary" type="button" onClick={props.onStartNewCareer}>
              Start New Career
            </button>
          </div>
        </section>

        <section className="command-panel save-import-panel">
          <div className="panel-header">
            <div>
              <h2>Import Save</h2>
              <p className="panel-summary panel-summary-tight">{importStatusText(importResult)}</p>
            </div>
            <span>{importResult?.ok ? "Preview ready" : "No write yet"}</span>
          </div>

          <label className="browse-field save-file-field">
            <span>Choose JSON File</span>
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Import Save JSON file"
              onChange={(event) => handleImportFile(event.currentTarget.files?.[0])}
            />
          </label>

          <label className="browse-field save-import-textarea">
            <span>Paste JSON</span>
            <textarea
              aria-label="Import Save JSON"
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setImportResult(null);
              }}
              placeholder='{"version": 8, ... }'
            />
          </label>

          <div className="save-action-row">
            <button className="command-button command-button-secondary" type="button" onClick={() => previewImport()} disabled={!importText.trim()}>
              Preview Import
            </button>
            <button className="command-button command-button-primary" type="button" onClick={confirmImport} disabled={!importResult?.ok}>
              Confirm Import
            </button>
          </div>

          {previewSummary && (
            <div className="import-preview-box" role="status" aria-live="polite">
              <div>
                <span>{previewSummary.mode}</span>
                <strong>{previewSummary.headline}</strong>
                <p>{previewSummary.detail}</p>
              </div>
              <div className="save-metadata-grid save-metadata-grid-compact">
                {previewSummary.rows.slice(0, 4).map((row) => (
                  <div key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          {importResult && !importResult.ok && (
            <div className="import-error-box" role="alert">
              <strong>{importResult.reason === "malformed_json" ? "Malformed JSON" : "Schema invalid"}</strong>
              <p>{importResult.message}</p>
              {importResult.issues && (
                <ul>
                  {importResult.issues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="command-panel command-panel-full">
          <div className="panel-header">
            <div>
              <h2>Danger Zone</h2>
              <p className="panel-summary panel-summary-tight">
                These actions name the exact storage they affect. Tournament reset, career replacement, active save deletion, and quarantine cleanup are separate controls.
              </p>
            </div>
            <span>Explicit confirm</span>
          </div>

          <div className="danger-action-grid">
            <div className="danger-zone">
              <strong>Delete active local save</strong>
              <p>Removes only <code>{STORAGE_KEY}</code> and returns to the clean launch decision surface.</p>
              <button className="command-button command-button-secondary" type="button" onClick={() => setPendingDanger("delete-active")} disabled={!props.activeSavePresent}>
                Delete Active Local Save
              </button>
            </div>

            <div className="danger-zone">
              <strong>Delete quarantined backup</strong>
              <p>Removes only <code>{CORRUPT_STORAGE_KEY}</code>. Invalid imports are rejected before this backup is touched.</p>
              <button className="command-button command-button-secondary" type="button" onClick={() => setPendingDanger("delete-corrupt")} disabled={!props.corruptSavePresent}>
                Delete Quarantined Save
              </button>
            </div>
          </div>

          {pendingDanger && (
            <div className="danger-confirm-strip" role="alert">
              <div>
                <strong>{pendingDanger === "delete-active" ? "Confirm active save deletion" : "Confirm quarantine deletion"}</strong>
                <p>
                  {pendingDanger === "delete-active"
                    ? "This cannot be undone inside the app. Export JSON first if you want a backup."
                    : "This clears the recovery backup only; the active save is not changed."}
                </p>
              </div>
              <div className="save-action-row">
                <button className="command-button command-button-secondary" type="button" onClick={() => setPendingDanger(null)}>
                  Cancel
                </button>
                <button className="command-button command-button-primary" type="button" onClick={confirmDanger}>
                  Confirm
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {notice && <p className="save-manager-notice" role="status" aria-live="polite">{notice}</p>}
    </section>
  );
}
