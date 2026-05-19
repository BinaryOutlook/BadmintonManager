import type { ReactNode } from "react";
import { useOptionalTournamentNavigation } from "../app/tournamentNavigation";

interface TournamentLinkProps {
  seasonId?: string | null;
  eventId?: string | null;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

const placeholderLabels = new Set([
  "active entry",
  "no active entry",
  "no event",
  "no open event",
  "pending",
  "season planning",
  "tbd"
]);

function validAddressPart(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlaceholderLabel(children: ReactNode) {
  return typeof children === "string" && placeholderLabels.has(children.trim().toLowerCase());
}

export function TournamentLink(props: TournamentLinkProps) {
  const openTournamentHome = useOptionalTournamentNavigation();

  if (!validAddressPart(props.seasonId) || !validAddressPart(props.eventId) || isPlaceholderLabel(props.children)) {
    return <>{props.children}</>;
  }

  if (!openTournamentHome) {
    throw new Error("TournamentLink must be used inside TournamentNavigationProvider when the address is known.");
  }

  const seasonId = props.seasonId!.trim();
  const eventId = props.eventId!.trim();
  const visibleLabel = typeof props.children === "string" ? props.children : null;

  return (
    <button
      className={props.className ?? "tournament-link-button"}
      type="button"
      aria-label={props.ariaLabel ?? (visibleLabel ? `Open tournament home for ${visibleLabel}` : "Open tournament home")}
      onClick={() => openTournamentHome({ seasonId, eventId })}
    >
      {props.children}
    </button>
  );
}
