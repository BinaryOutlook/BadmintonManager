import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveManagerView } from "../../components/SaveManagerView";
import { CURRENT_SAVE_VERSION, type PersistedSave } from "../../game/store/save";
import type { SaveSlotEnvelope } from "../../game/store/saveRepository";

function setupSave(seed = 12): PersistedSave {
  return {
    version: CURRENT_SAVE_VERSION,
    selectedPlayerId: "player-test",
    plannedTacticKey: "balancedControl",
    seed,
    tournament: null,
    liveMatch: null,
    career: null
  };
}

function slot(overrides: Partial<SaveSlotEnvelope> = {}): SaveSlotEnvelope {
  return {
    storageVersion: 1,
    slotId: "slot-one",
    name: "Singapore Project",
    createdAt: "2026-07-13T08:00:00.000Z",
    updatedAt: "2026-07-13T09:00:00.000Z",
    lastPlayedAt: "2026-07-13T09:00:00.000Z",
    archivedAt: null,
    revision: 4,
    save: setupSave(),
    ...overrides
  };
}

function props(overrides: Partial<React.ComponentProps<typeof SaveManagerView>> = {}) {
  return {
    saveSlots: [
      slot(),
      slot({ slotId: "slot-two", name: "Academy Build", revision: 2, lastPlayedAt: "2026-07-12T09:00:00.000Z" }),
      slot({ slotId: "slot-old", name: "Archived Run", archivedAt: "2026-07-10T09:00:00.000Z" })
    ],
    activeSaveSlotId: "slot-one",
    quarantinedSlotCount: 2,
    quarantinedSlotCounts: { "slot-one": 2 },
    saveBackupCounts: { "slot-one": 2, "slot-two": 0, "slot-old": 1 },
    corruptSavePresent: false,
    saveRecovery: null,
    onContinueLocalSave: vi.fn(),
    onSwitchSaveSlot: vi.fn(),
    onRenameSaveSlot: vi.fn(),
    onArchiveSaveSlot: vi.fn(),
    onRestoreLatestSaveBackup: vi.fn(),
    onCreateEmptySaveSlot: vi.fn(),
    onImportSaveAsSlot: vi.fn(),
    onDuplicateSaveSlot: vi.fn(),
    onDeleteSaveSlot: vi.fn(),
    onExportSave: vi.fn(() => setupSave()),
    onDeleteLegacySource: vi.fn(() => true),
    onDeleteCorruptSave: vi.fn(),
    ...overrides
  };
}

function cardFor(name: string) {
  return screen.getByRole("heading", { name }).closest("article") as HTMLElement;
}

describe("SaveManagerView", () => {
  it("shows live and archived careers with inspectable trust metadata and explicit switching", () => {
    const onContinueLocalSave = vi.fn();
    const onSwitchSaveSlot = vi.fn();
    const onArchiveSaveSlot = vi.fn();
    render(<SaveManagerView {...props({ onContinueLocalSave, onSwitchSaveSlot, onArchiveSaveSlot })} />);

    expect(screen.getByRole("heading", { name: "Live careers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archived careers" })).toBeInTheDocument();

    const activeCard = within(cardFor("Singapore Project"));
    expect(activeCard.getByText("Active")).toBeInTheDocument();
    expect(activeCard.getByText("r4")).toBeInTheDocument();
    expect(activeCard.getByText(`Save v${CURRENT_SAVE_VERSION}`)).toBeInTheDocument();
    expect(activeCard.getByText(/13 Jul 2026/)).toBeInTheDocument();
    expect(activeCard.getByText("Verified backups").parentElement).toHaveTextContent("2");
    expect(activeCard.getByText("Quarantined records").parentElement).toHaveTextContent("2");
    fireEvent.click(activeCard.getByRole("button", { name: "Continue" }));
    expect(onContinueLocalSave).toHaveBeenCalledTimes(1);

    fireEvent.click(within(cardFor("Academy Build")).getByRole("button", { name: "Switch to Career" }));
    expect(onSwitchSaveSlot).toHaveBeenCalledWith("slot-two");

    fireEvent.click(within(cardFor("Archived Run")).getByRole("button", { name: "Restore Career" }));
    expect(onArchiveSaveSlot).toHaveBeenCalledWith("slot-old");
  });

  it("renames, duplicates, archives, restores backups, and permanently deletes through distinct controls", () => {
    const onRenameSaveSlot = vi.fn();
    const onDuplicateSaveSlot = vi.fn();
    const onArchiveSaveSlot = vi.fn();
    const onRestoreLatestSaveBackup = vi.fn();
    const onDeleteSaveSlot = vi.fn();
    render(
      <SaveManagerView
        {...props({
          onRenameSaveSlot,
          onDuplicateSaveSlot,
          onArchiveSaveSlot,
          onRestoreLatestSaveBackup,
          onDeleteSaveSlot
        })}
      />
    );

    let activeCard = within(cardFor("Singapore Project"));
    fireEvent.click(activeCard.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("Career name"), { target: { value: "World Tour Project" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Name" }));
    expect(onRenameSaveSlot).toHaveBeenCalledWith("slot-one", "World Tour Project");

    activeCard = within(cardFor("Singapore Project"));
    fireEvent.click(activeCard.getByRole("button", { name: "Duplicate" }));
    expect(onDuplicateSaveSlot).toHaveBeenCalledWith("slot-one");

    fireEvent.click(activeCard.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("The career stays on this device");
    fireEvent.click(screen.getByRole("button", { name: "Archive Career" }));
    expect(onArchiveSaveSlot).toHaveBeenCalledWith("slot-one");

    fireEvent.click(activeCard.getByRole("button", { name: "Restore latest backup for Singapore Project" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("current revision is preserved as a backup");
    fireEvent.click(screen.getByRole("button", { name: "Restore Latest Backup" }));
    expect(onRestoreLatestSaveBackup).toHaveBeenCalledWith("slot-one");

    fireEvent.click(activeCard.getByRole("button", { name: "Permanently Delete" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("every local revision backup");
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Permanently Delete" }));
    expect(onDeleteSaveSlot).toHaveBeenCalledWith("slot-one");
  });

  it("creates an empty career and imports validated JSON into a new slot without overwrite semantics", () => {
    const onCreateEmptySaveSlot = vi.fn();
    const onImportSaveAsSlot = vi.fn();
    const imported = setupSave(72);
    render(<SaveManagerView {...props({ onCreateEmptySaveSlot, onImportSaveAsSlot })} />);

    fireEvent.change(screen.getByLabelText(/Career name \(optional\)/), { target: { value: "Road to Finals" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Empty Career" }));
    expect(onCreateEmptySaveSlot).toHaveBeenCalledWith("Road to Finals");

    fireEvent.change(screen.getByLabelText("Import save JSON"), { target: { value: JSON.stringify(imported) } });
    fireEvent.change(screen.getByLabelText(/New career name/), { target: { value: "Imported Project" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview Import" }));
    expect(screen.getByText(/no existing career is overwritten/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import as New Slot" }));
    expect(onImportSaveAsSlot).toHaveBeenCalledWith(imported, "Imported Project");
  });

  it("keeps recovery controls scoped to legacy keys", () => {
    const onDeleteCorruptSave = vi.fn();
    const onDeleteLegacySource = vi.fn(() => true);
    render(
      <SaveManagerView
        {...props({
          corruptSavePresent: true,
          saveRecovery: {
            reason: "invalid_schema",
            backupKey: "badminton-manager-save",
            disposition: "source_preserved",
            message: "Legacy source preserved."
          },
          onDeleteCorruptSave,
          onDeleteLegacySource
        })}
      />
    );

    expect(screen.getByRole("heading", { name: "Legacy Recovery" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear Unreadable Legacy Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Legacy Source" }));
    expect(onDeleteLegacySource).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Delete Legacy Quarantine Backup" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Legacy Backup" }));
    expect(onDeleteCorruptSave).toHaveBeenCalledTimes(1);
  });

  it("contains confirmation focus, closes on Escape, and restores the invoking control", () => {
    render(<SaveManagerView {...props()} />);
    const archiveButton = within(cardFor("Singapore Project")).getByRole("button", { name: "Archive" });

    archiveButton.focus();
    fireEvent.click(archiveButton);

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(archiveButton).toHaveFocus();
  });
});
