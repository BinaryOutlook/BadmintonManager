import { useMemo, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { playerMap } from "../game/content/players";
import type { Player } from "../game/core/models";
import type { RoundName, TournamentMatch, TournamentState } from "../game/tournament/tournament";

export interface KnockoutTreeProps {
  tournament: TournamentState;
  selectedPlayerId: string;
  title?: string;
  subtitle?: string;
  onOpenPlayerProfile: (playerId: string) => void;
}

type BracketRoundName = "R32" | RoundName;

type BracketRoundSlot = {
  name: BracketRoundName;
  label: string;
  matchCount: number;
};

type ScoreGame = {
  sideA: string;
  sideB: string;
};

type BracketNodeStyle = CSSProperties & {
  "--connector-height": string;
};

export const bracketRounds: BracketRoundSlot[] = [
  { name: "R32", label: "Round of 32", matchCount: 16 },
  { name: "R16", label: "Round of 16", matchCount: 8 },
  { name: "QF", label: "Quarter-Finals", matchCount: 4 },
  { name: "SF", label: "Semi-Finals", matchCount: 2 },
  { name: "F", label: "Final", matchCount: 1 }
];

export const previousRoundName: Record<RoundName, RoundName | null> = {
  R16: null,
  QF: "R16",
  SF: "QF",
  F: "SF"
};

function hasRound(tournament: TournamentState, roundName: BracketRoundName) {
  return tournament.rounds.some((entry) => String(entry.name) === roundName);
}

function bracketRoundsForTournament(tournament: TournamentState) {
  const supportsRoundOf32 = hasRound(tournament, "R32");

  return supportsRoundOf32 ? bracketRounds : bracketRounds.filter((round) => round.name !== "R32");
}

function previousRoundForTournament(tournament: TournamentState, roundName: BracketRoundName): BracketRoundName | null {
  if (roundName === "R32") {
    return null;
  }

  if (roundName === "R16" && hasRound(tournament, "R32")) {
    return "R32";
  }

  return previousRoundName[roundName];
}

function roundLabel(roundName: BracketRoundName) {
  return bracketRounds.find((round) => round.name === roundName)?.label ?? roundName;
}

function findRound(tournament: TournamentState, roundName: BracketRoundName) {
  return tournament.rounds.find((entry) => String(entry.name) === roundName);
}

export function placeholderLabel(
  tournament: TournamentState,
  roundName: BracketRoundName,
  matchIndex: number,
  side: "A" | "B"
) {
  const previousRound = previousRoundForTournament(tournament, roundName);

  if (!previousRound) {
    return `Seed slot ${matchIndex * 2 + (side === "A" ? 1 : 2)}`;
  }

  const sourceMatchIndex = matchIndex * 2 + (side === "A" ? 0 : 1);
  const sourceRound = findRound(tournament, previousRound);
  const winnerId = sourceRound?.matches[sourceMatchIndex]?.winnerId;

  if (winnerId) {
    return playerMap[winnerId]?.name ?? winnerId;
  }

  return `Winner ${previousRound}-${sourceMatchIndex + 1}`;
}

function placeholderAddress(
  tournament: TournamentState,
  roundName: BracketRoundName,
  matchIndex: number,
  side: "A" | "B",
  displayNames: Record<string, string>
) {
  const previousRound = previousRoundForTournament(tournament, roundName);

  if (!previousRound) {
    return {
      label: `Seed slot ${matchIndex * 2 + (side === "A" ? 1 : 2)}`,
      fullName: null,
      playerId: null
    };
  }

  const sourceMatchIndex = matchIndex * 2 + (side === "A" ? 0 : 1);
  const sourceRound = findRound(tournament, previousRound);
  const winnerId = sourceRound?.matches[sourceMatchIndex]?.winnerId;
  const winner = winnerId ? playerMap[winnerId] : undefined;

  if (winner) {
    return {
      label: displayNames[winner.id] ?? compactBracketDisplayName(winner.name),
      fullName: winner.name,
      playerId: winner.id
    };
  }

  return {
    label: `Winner ${previousRound}-${sourceMatchIndex + 1}`,
    fullName: null,
    playerId: null
  };
}

function nameParts(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const lastName = parts.length > 1 ? parts[parts.length - 1]! : parts[0] ?? "Unknown";
  const firstToken = parts.length > 1 ? parts[0]! : lastName;
  const normalizedFirst = firstToken.replace(/[^A-Za-z0-9]/g, "") || firstToken;

  return { firstToken: normalizedFirst, lastName };
}

function prefixToken(token: string, length: number) {
  const slice = Array.from(token).slice(0, Math.max(1, length)).join("");

  return slice.charAt(0).toUpperCase() + slice.slice(1);
}

export function compactBracketDisplayName(fullName: string, prefixLength = 1) {
  const { firstToken, lastName } = nameParts(fullName);

  return `${prefixToken(firstToken, prefixLength)}. ${lastName}`;
}

export function compactBracketNamesForDraw(players: ReadonlyArray<Pick<Player, "id" | "name">>) {
  const baseNames = new Map<string, string>();

  for (const player of players) {
    baseNames.set(player.id, compactBracketDisplayName(player.name));
  }

  const collisionGroups = new Map<string, Array<Pick<Player, "id" | "name">>>();

  for (const player of players) {
    const compactName = baseNames.get(player.id) ?? compactBracketDisplayName(player.name);
    collisionGroups.set(compactName, [...(collisionGroups.get(compactName) ?? []), player]);
  }

  const resolvedEntries = players.map((player) => [player.id, baseNames.get(player.id) ?? player.name] as const);
  const resolvedNames = Object.fromEntries(resolvedEntries) as Record<string, string>;

  for (const group of collisionGroups.values()) {
    if (group.length < 2) {
      continue;
    }

    const maxPrefixLength = Math.max(...group.map((player) => Array.from(nameParts(player.name).firstToken).length));
    const minimumCollisionPrefix = Math.min(3, maxPrefixLength);
    let uniqueNames: string[] | null = null;

    for (let prefixLength = minimumCollisionPrefix; prefixLength <= maxPrefixLength; prefixLength += 1) {
      const candidates = group.map((player) => compactBracketDisplayName(player.name, prefixLength));

      if (new Set(candidates).size === candidates.length) {
        uniqueNames = candidates;
        break;
      }
    }

    const names = uniqueNames ?? group.map((player, index) => `${nameParts(player.name).firstToken}. ${nameParts(player.name).lastName} ${index + 1}`);

    group.forEach((player, index) => {
      resolvedNames[player.id] = names[index] ?? player.name;
    });
  }

  return resolvedNames;
}

function drawPlayers(tournament: TournamentState) {
  const playerIds = new Set<string>();

  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      playerIds.add(match.sideAId);
      playerIds.add(match.sideBId);
    }
  }

  return [...playerIds].map((playerId) => playerMap[playerId]).filter((player): player is Player => Boolean(player));
}

export function parseScorelineGames(scoreline: string | undefined): ScoreGame[] {
  if (!scoreline) {
    return [];
  }

  return [...scoreline.matchAll(/(\d+)\s*-\s*(\d+)/g)].slice(0, 3).map((match) => ({
    sideA: match[1] ?? "",
    sideB: match[2] ?? ""
  }));
}

function scoreCellsForSide(match: TournamentMatch | null, side: "A" | "B") {
  const games = parseScorelineGames(match?.scoreline);

  if (!match?.completed || games.length === 0) {
    return ["--", "--", ""];
  }

  const cells = games.map((game) => (side === "A" ? game.sideA : game.sideB));

  while (cells.length < 3) {
    cells.push("");
  }

  return cells.slice(0, 3);
}

function BracketPlayerButton(props: {
  playerId: string | null;
  label: string;
  fullName: string | null;
  onOpenPlayerProfile: (playerId: string) => void;
}) {
  const playerId = props.playerId;

  if (!playerId) {
    return <span className="bracket-player-placeholder" title={props.fullName ?? props.label}>{props.label}</span>;
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    props.onOpenPlayerProfile(playerId);
  };

  return (
    <button
      className="profile-name-button bracket-profile-button"
      type="button"
      title={props.fullName ?? props.label}
      onClick={handleClick}
    >
      {props.label}
    </button>
  );
}

export function gridRowForMatch(roundIndex: number, matchIndex: number) {
  const roundSize = 2 ** (roundIndex + 1);
  const rowStart = matchIndex * roundSize + 1 + Math.floor((roundSize - 2) / 2);

  return `${rowStart} / span 2`;
}

function statusForPlayer(match: TournamentMatch, playerId: string | null, selectedPlayerId: string) {
  if (match.completed && playerId && match.winnerId === playerId) {
    return "*";
  }

  if (!match.completed && match.managed && playerId === selectedPlayerId) {
    return "up next";
  }

  if (!match.completed && match.managed) {
    return "live";
  }

  if (!match.completed) {
    return "pending";
  }

  return "";
}

function matchStatus(match: TournamentMatch) {
  if (match.completed) {
    return match.winnerId ? "Complete" : "Result pending";
  }

  return match.managed ? "Up next" : "Pending simulation";
}

function matchSourceLabel(match: TournamentMatch) {
  if (match.managed && match.completed) {
    return "Played managed match";
  }

  if (match.managed) {
    return "Managed match queue";
  }

  if (match.simulationFidelity === "quick") {
    return "Quick simulation";
  }

  if (match.simulationFidelity === "detailed") {
    return "Detailed simulation";
  }

  return "Bracket archive";
}

function managedStateForMatch(match: TournamentMatch, selectedPlayerId: string) {
  const selectedInMatch = match.sideAId === selectedPlayerId || match.sideBId === selectedPlayerId;

  if (!selectedInMatch) {
    return "Background court";
  }

  if (!match.completed) {
    return "Managed athlete due";
  }

  return match.winnerId === selectedPlayerId ? "Managed athlete advanced" : "Managed athlete eliminated";
}

function fullNameForPlayer(playerId: string) {
  return playerMap[playerId]?.name ?? playerId;
}

function defaultSelectedMatchId(tournament: TournamentState, selectedPlayerId: string) {
  const matches = tournament.rounds.flatMap((round) => round.matches);
  const managedPendingMatch = matches.find((match) => match.managed && !match.completed);

  if (managedPendingMatch) {
    return managedPendingMatch.id;
  }

  const managedMatch = matches.find((match) => match.sideAId === selectedPlayerId || match.sideBId === selectedPlayerId);

  if (managedMatch) {
    return managedMatch.id;
  }

  const completedFinal = findRound(tournament, "F")?.matches.find((match) => match.completed);

  return completedFinal?.id ?? matches.find((match) => match.completed)?.id ?? matches[0]?.id ?? null;
}

function matchById(tournament: TournamentState, matchId: string | null) {
  if (!matchId) {
    return null;
  }

  return tournament.rounds.flatMap((round) => round.matches).find((match) => match.id === matchId) ?? null;
}

function compactScoreRow(props: {
  match: TournamentMatch | null;
  side: "A" | "B";
  address: { playerId: string | null; label: string; fullName: string | null };
  selectedPlayerId: string;
  onOpenPlayerProfile: (playerId: string) => void;
}) {
  const scores = scoreCellsForSide(props.match, props.side);
  const status = props.match ? statusForPlayer(props.match, props.address.playerId, props.selectedPlayerId) : "";
  const rowClassName = `bracket-score-row ${status === "*" ? "bracket-score-row-winner" : ""} ${
    status === "up next" || status === "live" ? "bracket-score-row-live" : ""
  }`;

  return (
    <div className={rowClassName}>
      <BracketPlayerButton
        playerId={props.address.playerId}
        label={props.address.label}
        fullName={props.address.fullName}
        onOpenPlayerProfile={props.onOpenPlayerProfile}
      />
      {scores.map((score, index) => (
        <span key={`${props.side}-${index}`} className="bracket-score-cell" aria-hidden={score === "" ? true : undefined}>
          {score}
        </span>
      ))}
      <span className="bracket-status-cell">{status}</span>
    </div>
  );
}

function SelectedMatchDetail(props: {
  match: TournamentMatch | null;
  selectedPlayerId: string;
  onOpenPlayerProfile: (playerId: string) => void;
}) {
  if (!props.match) {
    return (
      <aside className="bracket-detail-panel" aria-label="Selected match details">
        <div className="panel-header">
          <h3>Selected Match</h3>
          <span>No match selected</span>
        </div>
        <p className="panel-summary">Select a compact bracket cell to inspect full names, scoreline, and source context.</p>
      </aside>
    );
  }

  const sideA = playerMap[props.match.sideAId];
  const sideB = playerMap[props.match.sideBId];
  const winnerName = props.match.winnerId ? fullNameForPlayer(props.match.winnerId) : null;
  const summaryEvents = props.match.summaryEvents?.slice(0, 2) ?? [];

  return (
    <aside className="bracket-detail-panel" aria-label="Selected match details">
      <div className="panel-header bracket-detail-header">
        <h3>Selected Match</h3>
        <span>{roundLabel(String(props.match.round) as BracketRoundName)}</span>
      </div>

      <div className="bracket-detail-versus">
        {[sideA, sideB].map((player, index) => {
          const playerId = index === 0 ? props.match!.sideAId : props.match!.sideBId;
          const isWinner = props.match!.winnerId === playerId;

          return (
            <div key={playerId} className={isWinner ? "bracket-detail-player bracket-detail-player-winner" : "bracket-detail-player"}>
              <span>{index === 0 ? "Side A" : "Side B"}</span>
              <button className="profile-name-button" type="button" onClick={() => props.onOpenPlayerProfile(playerId)}>
                {player?.name ?? playerId}
              </button>
              <small>{isWinner ? "Winner" : props.match!.completed ? "Defeated" : "Awaiting result"}</small>
            </div>
          );
        })}
      </div>

      <div className="bracket-detail-grid">
        <div>
          <span>Status</span>
          <strong>{matchStatus(props.match)}</strong>
        </div>
        <div>
          <span>Scoreline</span>
          <strong>{props.match.scoreline ?? "Pending"}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{matchSourceLabel(props.match)}</strong>
        </div>
        <div>
          <span>Managed State</span>
          <strong>{managedStateForMatch(props.match, props.selectedPlayerId)}</strong>
        </div>
      </div>

      {winnerName ? <p className="panel-summary">{winnerName} claimed this court. Full scoreline: {props.match.scoreline ?? "unavailable"}.</p> : null}

      {summaryEvents.length > 0 ? (
        <div className="bracket-detail-events" aria-label="Selected match simulation evidence">
          {summaryEvents.map((event) => (
            <div key={`${event.kind}-${event.title}`}>
              <strong>{event.title}</strong>
              <small>{event.detail}</small>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

export function KnockoutTree(props: KnockoutTreeProps) {
  const roundSlots = bracketRoundsForTournament(props.tournament);
  const openingMatchCount = roundSlots[0]?.matchCount ?? 8;
  const bracketMinWidthRem = roundSlots.length * 11.25 + Math.max(0, roundSlots.length - 1) * 1;
  const gridStyle: CSSProperties = {
    minWidth: `${bracketMinWidthRem}rem`,
    gridTemplateColumns: `repeat(${roundSlots.length}, minmax(10.5rem, 1fr))`
  };
  const matchGridStyle: CSSProperties = {
    ...gridStyle,
    gridTemplateRows: `repeat(${openingMatchCount * 2}, var(--bracket-row))`
  };
  const displayNames = useMemo(
    () => compactBracketNamesForDraw(drawPlayers(props.tournament)),
    [props.tournament]
  );
  const [selectedMatchId, setSelectedMatchId] = useState(() => defaultSelectedMatchId(props.tournament, props.selectedPlayerId));
  const selectedMatch = matchById(props.tournament, selectedMatchId) ?? matchById(props.tournament, defaultSelectedMatchId(props.tournament, props.selectedPlayerId));

  const handleNodeKeyDown = (event: KeyboardEvent<HTMLElement>, matchId: string) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    setSelectedMatchId(matchId);
  };

  return (
    <section className="command-panel command-panel-full knockout-tree-panel">
      <div className="panel-header">
        <h2>{props.title ?? "Knockout Tree"}</h2>
        <span>{props.subtitle ?? "Full binary path to the final"}</span>
      </div>

      <div className="bracket-work-surface">
        <div className="bracket-tree" aria-label="Knockout tree">
          <div className="bracket-round-labels" style={gridStyle}>
            {roundSlots.map((roundSlot) => (
              <h3 key={roundSlot.name}>{roundSlot.label}</h3>
            ))}
          </div>

          <div className="bracket-match-grid" style={matchGridStyle}>
            {roundSlots.map((roundSlot, roundIndex) => {
              const round = findRound(props.tournament, roundSlot.name);

              return Array.from({ length: roundSlot.matchCount }).map((_, matchIndex) => {
                const match = round?.matches[matchIndex];
                const nodeClassName = `bracket-node ${roundIndex === 0 ? "bracket-node-opening" : ""} ${
                  roundIndex === roundSlots.length - 1 ? "bracket-node-final" : ""
                }`;
                const nodeStyle: BracketNodeStyle = {
                  gridColumn: roundIndex + 1,
                  gridRow: gridRowForMatch(roundIndex, matchIndex),
                  "--connector-height": `calc(var(--bracket-row) * ${2 ** roundIndex})`
                };

                if (!match) {
                  const sideAPlaceholder = placeholderAddress(props.tournament, roundSlot.name, matchIndex, "A", displayNames);
                  const sideBPlaceholder = placeholderAddress(props.tournament, roundSlot.name, matchIndex, "B", displayNames);

                  return (
                    <div
                      key={`${roundSlot.name}-${matchIndex + 1}`}
                      className={nodeClassName}
                      style={nodeStyle}
                    >
                      <article className="bracket-card bracket-card-tree bracket-card-placeholder">
                        {compactScoreRow({
                          match: null,
                          side: "A",
                          address: sideAPlaceholder,
                          selectedPlayerId: props.selectedPlayerId,
                          onOpenPlayerProfile: props.onOpenPlayerProfile
                        })}
                        {compactScoreRow({
                          match: null,
                          side: "B",
                          address: sideBPlaceholder,
                          selectedPlayerId: props.selectedPlayerId,
                          onOpenPlayerProfile: props.onOpenPlayerProfile
                        })}
                      </article>
                    </div>
                  );
                }

                const sideA = playerMap[match.sideAId];
                const sideB = playerMap[match.sideBId];
                const finalChampion = roundSlot.name === "F" && match.completed;
                const selected = selectedMatch?.id === match.id;
                const sideAAddress = {
                  playerId: sideA?.id ?? null,
                  label: sideA ? displayNames[sideA.id] ?? compactBracketDisplayName(sideA.name) : match.sideAId,
                  fullName: sideA?.name ?? match.sideAId
                };
                const sideBAddress = {
                  playerId: sideB?.id ?? null,
                  label: sideB ? displayNames[sideB.id] ?? compactBracketDisplayName(sideB.name) : match.sideBId,
                  fullName: sideB?.name ?? match.sideBId
                };

                return (
                  <div key={match.id} className={nodeClassName} style={nodeStyle}>
                    <article
                      aria-label={`Inspect ${roundLabel(roundSlot.name)} match ${matchIndex + 1}: ${sideA?.name ?? match.sideAId} vs ${sideB?.name ?? match.sideBId}`}
                      aria-pressed={selected}
                      className={`bracket-card bracket-card-tree ${
                        match.managed ? "bracket-card-managed" : ""
                      } ${match.completed ? "bracket-card-complete" : ""} ${
                        finalChampion ? "bracket-card-champion" : ""
                      } ${selected ? "bracket-card-selected" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMatchId(match.id)}
                      onKeyDown={(event) => handleNodeKeyDown(event, match.id)}
                    >
                      {compactScoreRow({
                        match,
                        side: "A",
                        address: sideAAddress,
                        selectedPlayerId: props.selectedPlayerId,
                        onOpenPlayerProfile: props.onOpenPlayerProfile
                      })}
                      {compactScoreRow({
                        match,
                        side: "B",
                        address: sideBAddress,
                        selectedPlayerId: props.selectedPlayerId,
                        onOpenPlayerProfile: props.onOpenPlayerProfile
                      })}
                    </article>
                  </div>
                );
              });
            })}
          </div>
        </div>

        <SelectedMatchDetail
          match={selectedMatch}
          selectedPlayerId={props.selectedPlayerId}
          onOpenPlayerProfile={props.onOpenPlayerProfile}
        />
      </div>
    </section>
  );
}
