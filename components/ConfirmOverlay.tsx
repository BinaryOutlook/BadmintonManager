import { useModalFocus } from "./useModalFocus";

interface ConfirmOverlayProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmOverlay(props: ConfirmOverlayProps) {
  const { modalRef, handleModalKeyDown } = useModalFocus(props.open, props.onCancel);

  if (!props.open) {
    return null;
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        ref={modalRef}
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        tabIndex={-1}
        onKeyDown={handleModalKeyDown}
      >
        <div className="modal-header">
          <div>
            <p className="screen-kicker">Confirmation</p>
            <h2 id="confirm-title">{props.title}</h2>
          </div>
        </div>
        <p id="confirm-message">{props.message}</p>
        <div className="confirm-actions">
          <button className="command-button command-button-secondary" type="button" onClick={props.onCancel}>
            Cancel
          </button>
          <button className="command-button command-button-primary" type="button" onClick={props.onConfirm}>
            {props.confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
