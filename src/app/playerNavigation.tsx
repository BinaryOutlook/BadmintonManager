import { createContext, type ReactNode, useContext } from "react";

const PlayerNavigationContext = createContext<((playerId: string) => void) | null>(null);

export function PlayerNavigationProvider(props: {
  onOpenPlayerProfile: (playerId: string) => void;
  children: ReactNode;
}) {
  return (
    <PlayerNavigationContext.Provider value={props.onOpenPlayerProfile}>
      {props.children}
    </PlayerNavigationContext.Provider>
  );
}

export function usePlayerNavigation() {
  const openPlayerProfile = useContext(PlayerNavigationContext);

  if (!openPlayerProfile) {
    throw new Error("usePlayerNavigation must be used inside PlayerNavigationProvider.");
  }

  return openPlayerProfile;
}
