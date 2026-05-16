import { playerMap } from "../game/content/players";
import type { RoundName, TournamentState } from "../game/tournament/tournament";

export interface KnockoutTreeProps {
  tournament: TournamentState;
  selectedPlayerId: string;
  title?: string;
  subtitle?: string;
  onOpenPlayerProfile: (playerId: string) => void;
}

export const bracketRounds: Array<{ name: RoundName; label: string; matchCount: number }> = [
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

export function placeholderLabel(
  tournament: TournamentState,
  roundName: RoundName,
  matchIndex: number,
  side: "A" | "B"
) {
  const previousRound = previousRoundName[roundName];

  if (!previousRound) {
    return `Seed slot ${matchIndex * 2 + (side === "A" ? 1 : 2)}`;
  }

  const sourceMatchIndex = matchIndex * 2 + (side === "A" ? 0 : 1);
  const sourceRound = tournament.rounds.find((entry) => entry.name === previousRound);
  const winnerId = sourceRound?.matches[sourceMatchIndex]?.winnerId;

  if (winnerId) {
    return playerMap[winnerId]?.name ?? winnerId;
  }

  return `Winner ${previousRound}-${sourceMatchIndex + 1}`;
}

export function gridRowForMatch(roundIndex: number, matchIndex: number) {
  const roundSize = 2 ** (roundIndex + 1);
  const rowStart = matchIndex * roundSize + 1 + Math.floor((roundSize - 2) / 2);

  return `${rowStart} / span 2`;
}

export function KnockoutTree(props: KnockoutTreeProps) {
  return (
    <section className="command-panel command-panel-full">
      <div className="panel-header">
        <h2>{props.title ?? "Knockout Tree"}</h2>
        <span>{props.subtitle ?? "Full binary path to the final"}</span>
      </div>

      <div className="bracket-tree" aria-label="Knockout tree">
        <div className="bracket-round-labels">
          {bracketRounds.map((roundSlot) => (
            <h3 key={roundSlot.name}>{roundSlot.label}</h3>
          ))}
        </div>

        <div className="bracket-match-grid">
          {bracketRounds.map((roundSlot, roundIndex) => {
            const round = props.tournament.rounds.find((entry) => entry.name === roundSlot.name);

            return Array.from({ length: roundSlot.matchCount }).map((_, matchIndex) => {
              const match = round?.matches[matchIndex];
              const nodeClassName = `bracket-node bracket-node-col-${roundIndex} ${
                roundIndex === 0 ? "bracket-node-opening" : ""
              } ${roundIndex === bracketRounds.length - 1 ? "bracket-node-final" : ""}`;
              const nodeStyle = {
                gridColumn: roundIndex + 1,
                gridRow: gridRowForMatch(roundIndex, matchIndex)
              };

              if (!match) {
                return (
                  <div
                    key={`${roundSlot.name}-${matchIndex + 1}`}
                    className={nodeClassName}
                    style={nodeStyle}
                  >
                    <article className="bracket-card bracket-card-tree bracket-card-placeholder">
                      <div className="bracket-row">
                        <span>{placeholderLabel(props.tournament, roundSlot.name, matchIndex, "A")}</span>
                        <span>TBD</span>
                      </div>
                      <div className="bracket-row">
                        <span>{placeholderLabel(props.tournament, roundSlot.name, matchIndex, "B")}</span>
                        <span>TBD</span>
                      </div>
                      <small>Awaiting previous winners</small>
                    </article>
                  </div>
                );
              }

              const sideA = playerMap[match.sideAId];
              const sideB = playerMap[match.sideBId];
              const pendingManaged = match.managed && !match.completed;
              const finalChampion = roundSlot.name === "F" && match.completed;
              const backgroundSummary = !match.managed ? match.summaryEvents?.[0] : undefined;

              return (
                <div key={match.id} className={nodeClassName} style={nodeStyle}>
                  <article
                    className={`bracket-card bracket-card-tree ${
                      match.managed ? "bracket-card-managed" : ""
                    } ${match.completed ? "bracket-card-complete" : ""} ${
                      finalChampion ? "bracket-card-champion" : ""
                    }`}
                  >
                    <div className="bracket-row">
                      <span>
                        <button
                          className="profile-name-button bracket-profile-button"
                          type="button"
                          onClick={() => props.onOpenPlayerProfile(sideA.id)}
                        >
                          {sideA.name}
                        </button>
                      </span>
                      <span>
                        {match.completed && match.winnerId === sideA.id
                          ? "W"
                          : pendingManaged && sideA.id === props.selectedPlayerId
                            ? "UP NEXT"
                            : ""}
                      </span>
                    </div>
                    <div className="bracket-row">
                      <span>
                        <button
                          className="profile-name-button bracket-profile-button"
                          type="button"
                          onClick={() => props.onOpenPlayerProfile(sideB.id)}
                        >
                          {sideB.name}
                        </button>
                      </span>
                      <span>
                        {match.completed && match.winnerId === sideB.id
                          ? "W"
                          : pendingManaged && sideB.id === props.selectedPlayerId
                            ? "UP NEXT"
                            : pendingManaged
                              ? "LIVE"
                              : ""}
                      </span>
                    </div>
                    <small className="bracket-scoreline">
                      {match.completed
                        ? finalChampion
                          ? `Champion decided - ${match.scoreline}`
                          : match.scoreline
                        : "Managed match pending"}
                    </small>
                    {match.completed && backgroundSummary ? (
                      <small className="bracket-context-line" title={backgroundSummary.detail}>
                        {backgroundSummary.title}
                      </small>
                    ) : null}
                  </article>
                </div>
              );
            });
          })}
        </div>
      </div>
    </section>
  );
}
