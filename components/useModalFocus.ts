import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function isFocusable(element: HTMLElement) {
  return (
    !element.hasAttribute("disabled") &&
    element.getAttribute("aria-hidden") !== "true" &&
    element.tabIndex >= 0 &&
    (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)
  );
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(isFocusable);
}

export function useModalFocus(open: boolean, onEscape: () => void) {
  const modalRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }

    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;

    if (!modal) {
      return;
    }

    const initialFocusTarget = getFocusableElements(modal)[0] ?? modal;
    initialFocusTarget.focus({ preventScroll: true });

    return () => {
      if (previousActiveElement && document.contains(previousActiveElement)) {
        previousActiveElement.focus({ preventScroll: true });
      }
    };
  }, [open]);

  function handleModalKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const modal = modalRef.current;

    if (!modal) {
      return;
    }

    const focusableElements = getFocusableElements(modal);

    if (focusableElements.length === 0) {
      event.preventDefault();
      modal.focus({ preventScroll: true });
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus({ preventScroll: true });
      return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus({ preventScroll: true });
      return;
    }

    if (activeElement instanceof Node && modal.contains(activeElement)) {
      return;
    }

    event.preventDefault();
    firstElement.focus({ preventScroll: true });
  }

  return { modalRef, handleModalKeyDown };
}
