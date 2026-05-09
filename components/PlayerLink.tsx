import { Fragment } from "react/jsx-runtime";
import { playerMap } from "../game/content/players";
import { usePlayerNavigation } from "../app/playerNavigation";

interface PlayerLinkProps {
  playerId: string;
  className?: string;
  children?: string;
}

const playersByName = Object.values(playerMap).sort((left, right) => right.name.length - left.name.length);
const playerByName = new Map(playersByName.map((player) => [player.name, player]));
const playerNamePattern = new RegExp(
  `(${playersByName.map((player) => escapeRegExp(player.name)).join("|")})`,
  "g"
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function PlayerLink(props: PlayerLinkProps) {
  const openPlayerProfile = usePlayerNavigation();
  const player = playerMap[props.playerId];

  if (!player) {
    return <>{props.children ?? props.playerId}</>;
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

export function SmartPlayerText(props: { text: string; className?: string }) {
  const parts = props.text.split(playerNamePattern);

  if (parts.length === 1) {
    return <>{props.text}</>;
  }

  return (
    <span className={props.className}>
      {parts.map((part, index) => {
        const player = playerByName.get(part);

        if (!player) {
          return <Fragment key={`${part}-${index}`}>{part}</Fragment>;
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
