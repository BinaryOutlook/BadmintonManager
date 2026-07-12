import { Fragment } from "react/jsx-runtime";
import { playerMap } from "../game/content/players";
import { useOptionalPlayerDirectory, useOptionalPlayerNavigation } from "../app/playerNavigation";

interface PlayerLinkProps {
  playerId: string;
  className?: string;
  children?: string;
}

interface SmartPlayerTextProps {
  text: string;
  className?: string;
  onOpenPlayerProfile?: (playerId: string) => void;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPlayerNameIndex(playersById: Readonly<typeof playerMap>) {
  const playerNameGroups = Object.values(playersById).reduce((groups, player) => {
    const players = groups.get(player.name) ?? [];
    groups.set(player.name, [...players, player]);
    return groups;
  }, new Map<string, Array<(typeof playerMap)[string]>>());
  const uniquePlayersByName = new Map(
    [...playerNameGroups.entries()]
      .filter(([, players]) => players.length === 1)
      .map(([name, players]) => [name, players[0]!])
  );
  const uniquePlayerNames = [...uniquePlayersByName.keys()].sort((left, right) => right.length - left.length);
  const playerNamePattern = uniquePlayerNames.length > 0
    ? new RegExp(`(${uniquePlayerNames.map((name) => escapeRegExp(name)).join("|")})`, "g")
    : null;

  return { uniquePlayersByName, playerNamePattern };
}

export function PlayerLink(props: PlayerLinkProps) {
  const openPlayerProfile = useOptionalPlayerNavigation();
  const playersById = useOptionalPlayerDirectory() ?? playerMap;
  const player = playersById[props.playerId];

  if (!player) {
    return <>{props.children ?? props.playerId}</>;
  }

  if (!openPlayerProfile) {
    throw new Error("PlayerLink must be used inside PlayerNavigationProvider when playerId is known.");
  }

  return (
    <button
      className={props.className ?? "profile-name-button"}
      type="button"
      onClick={() => openPlayerProfile(player.id)}
    >
      {props.children ?? player.name}
    </button>
  );
}

export function SmartPlayerText(props: SmartPlayerTextProps) {
  const playersById = useOptionalPlayerDirectory() ?? playerMap;
  const { uniquePlayersByName, playerNamePattern } = buildPlayerNameIndex(playersById);
  const parts = playerNamePattern ? props.text.split(playerNamePattern) : [props.text];

  if (parts.length === 1) {
    return <>{props.text}</>;
  }

  return (
    <span className={props.className}>
      {parts.map((part, index) => {
        const player = uniquePlayersByName.get(part);

        if (!player) {
          return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
        }

        if (props.onOpenPlayerProfile) {
          return (
            <button
              key={`${player.id}-${index}`}
              className="smart-player-link"
              type="button"
              onClick={() => props.onOpenPlayerProfile?.(player.id)}
            >
              {player.name}
            </button>
          );
        }

        return (
          <PlayerLink key={`${player.id}-${index}`} playerId={player.id} className="smart-player-link">
            {player.name}
          </PlayerLink>
        );
      })}
    </span>
  );
}
