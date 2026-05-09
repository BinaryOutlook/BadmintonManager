export type ThemeAccent = "lime" | "cyan" | "rose" | "slate";

interface SettingsOverlayProps {
  open: boolean;
  themeAccent: ThemeAccent;
  onThemeAccentChange: (accent: ThemeAccent) => void;
  onRequestReset: () => void;
  onClose: () => void;
}

const themeOptions: Array<{ id: ThemeAccent; label: string; description: string }> = [
  { id: "lime", label: "Lime", description: "Original command-center accent." },
  { id: "cyan", label: "Cyan", description: "Cool tactical display accent." },
  { id: "rose", label: "Rose", description: "Higher-contrast pressure accent." },
  { id: "slate", label: "Slate", description: "Muted operational accent." }
];

export function SettingsOverlay(props: SettingsOverlayProps) {
  if (!props.open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="modal-header">
          <div>
            <p className="screen-kicker">Settings</p>
            <h2 id="settings-title">Console Preferences</h2>
          </div>
          <button className="modal-close-button" type="button" onClick={props.onClose} aria-label="Close settings">
            Close
          </button>
        </div>

        <div className="settings-section">
          <h3>Appearance</h3>
          <div className="theme-choice-grid">
            {themeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={
                  props.themeAccent === option.id
                    ? "theme-choice theme-choice-active"
                    : "theme-choice"
                }
                aria-pressed={props.themeAccent === option.id}
                onClick={() => props.onThemeAccentChange(option.id)}
              >
                <span className={`theme-swatch theme-swatch-${option.id}`} />
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <h3>Save And Session</h3>
          <p>
            Badminton Manager is local-first in this phase. Tournament progress and preferences stay
            on this device.
          </p>
          <button className="command-button command-button-secondary" type="button" onClick={props.onRequestReset}>
            New Session
          </button>
        </div>

        <div className="settings-section settings-section-muted">
          <h3>Game Decisions Live Elsewhere</h3>
          <p>
            Tactics, athlete selection, scouting, tactical intel, and event choices belong to their
            feature pages or focused overlays, not this settings window.
          </p>
        </div>
      </section>
    </div>
  );
}
