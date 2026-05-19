import { createContext, type ReactNode, useContext } from "react";
import type { TournamentAddress } from "../game/career/models";

type OpenTournamentHome = (address: TournamentAddress) => void;

const TournamentNavigationContext = createContext<OpenTournamentHome | null>(null);

export function TournamentNavigationProvider(props: {
  onOpenTournamentHome: OpenTournamentHome;
  children: ReactNode;
}) {
  return (
    <TournamentNavigationContext.Provider value={props.onOpenTournamentHome}>
      {props.children}
    </TournamentNavigationContext.Provider>
  );
}

export function useTournamentNavigation() {
  const openTournamentHome = useContext(TournamentNavigationContext);

  if (!openTournamentHome) {
    throw new Error("useTournamentNavigation must be used inside TournamentNavigationProvider.");
  }

  return openTournamentHome;
}

export function useOptionalTournamentNavigation() {
  return useContext(TournamentNavigationContext);
}
