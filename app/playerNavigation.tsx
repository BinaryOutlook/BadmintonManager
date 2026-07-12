import { createContext, type ReactNode, useContext } from "react";
import type { Player } from "../game/core/models";

interface PlayerNavigationContextValue {
  onOpenPlayerProfile: (playerId: string) => void;
  playersById?: Readonly<Record<string, Player>>;
}

const PlayerNavigationContext = createContext<PlayerNavigationContextValue | null>(null);

export function PlayerNavigationProvider(props: {
  onOpenPlayerProfile: (playerId: string) => void;
  playersById?: Readonly<Record<string, Player>>;
  children: ReactNode;
}) {
  return (
    <PlayerNavigationContext.Provider value={{
      onOpenPlayerProfile: props.onOpenPlayerProfile,
      playersById: props.playersById
    }}>
      {props.children}
    </PlayerNavigationContext.Provider>
  );
}

export function usePlayerNavigation() {
  const context = useContext(PlayerNavigationContext);

  if (!context) {
    throw new Error("usePlayerNavigation must be used inside PlayerNavigationProvider.");
  }

  return context.onOpenPlayerProfile;
}

export function useOptionalPlayerNavigation() {
  return useContext(PlayerNavigationContext)?.onOpenPlayerProfile ?? null;
}

export function useOptionalPlayerDirectory() {
  return useContext(PlayerNavigationContext)?.playersById;
}
