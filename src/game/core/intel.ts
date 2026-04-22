import type { TournamentState } from "../tournament/tournament";
import type { LiveCompetitorState, MatchTactic, Player, Side } from "./models";
import { deriveProfile } from "./ratings";

export type ThreatLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AthleteDossier {
  power: number;
  speed: number;
  stamina: number;
  control: number;
  formHeadline: string;
  formSummary: string;
}

export function deriveAthleteDossier(player: Player): AthleteDossier {
  const profile = deriveProfile(player);
  const power = Math.round(
    player.ratings.technical.smash * 0.58 +
      player.ratings.physical.explosivenessJump * 0.24 +
      player.ratings.mental.aggression * 0.18
  );
  const speed = Math.round(
    player.ratings.physical.footworkSpeed * 0.55 +
      player.ratings.physical.agilityBalance * 0.25 +
      player.ratings.mental.anticipation * 0.2
  );
  const stamina = Math.round(
    player.ratings.physical.stamina * 0.72 + profile.rallyTolerance * 0.28
  );
  const control = Math.round(
    profile.frontCourtControl * 0.45 +
      profile.pressureResistance * 0.25 +
      player.ratings.technical.dropShot * 0.15 +
      player.ratings.technical.serveReturn * 0.15
  );

  let formHeadline = "Ready for structured tournament play.";
  let formSummary = "Balanced telemetry suggests a stable opening-round operator.";

  if (power >= 88 && stamina >= 84) {
    formHeadline = "Peak physical condition.";
    formSummary = "Attack output and late-rally endurance both profile as major assets.";
  } else if (control >= 86) {
    formHeadline = "Excellent tactical discipline.";
    formSummary = "Front-court command and pressure resistance support lower-variance plans.";
  } else if (speed >= 86) {
    formHeadline = "Explosive transition athlete.";
    formSummary = "Recovery speed and anticipation can turn neutral rallies into quick pressure swings.";
  } else if (stamina >= 86) {
    formHeadline = "Built for long tactical exchanges.";
    formSummary = "The match can be stretched without the athlete falling apart physically.";
  }

  return {
    power,
    speed,
    stamina,
    control,
    formHeadline,
    formSummary
  };
}

export function deriveThreatReport(managedPlayer: Player, opponent: Player) {
  const managed = deriveProfile(managedPlayer);
  const threat = deriveProfile(opponent);

  const managedIndex =
    managed.attackPressure * 0.28 +
    managed.frontCourtControl * 0.18 +
    managed.recoveryQuality * 0.18 +
    managed.rallyTolerance * 0.18 +
    managed.pressureResistance * 0.18;
  const opponentIndex =
    threat.attackPressure * 0.28 +
    threat.frontCourtControl * 0.18 +
    threat.recoveryQuality * 0.18 +
    threat.rallyTolerance * 0.18 +
    threat.pressureResistance * 0.18;
  const gap = Math.round(opponentIndex - managedIndex);

  let level: ThreatLevel = "LOW";

  if (gap >= 7) {
    level = "HIGH";
  } else if (gap >= 1) {
    level = "MEDIUM";
  }

  const strengths = [
    {
      label: "Smash Power",
      value: Math.round(
        opponent.ratings.technical.smash * 0.74 +
          opponent.ratings.physical.explosivenessJump * 0.26
      ),
      accent: "rose" as const
    },
    {
      label: "Stamina",
      value: Math.round(
        opponent.ratings.physical.stamina * 0.66 + threat.rallyTolerance * 0.34
      ),
      accent: "lime" as const
    },
    {
      label: "Net Play",
      value: Math.round(
        opponent.ratings.technical.netPlay * 0.62 +
          opponent.ratings.technical.serveReturn * 0.18 +
          opponent.ratings.mental.anticipation * 0.2
      ),
      accent: "cyan" as const
    }
  ];

  const matchupSummary =
    level === "HIGH"
      ? `${opponent.name} profiles as a stronger overall opponent, so the match plan needs to deny clean initiative.`
      : level === "MEDIUM"
        ? `${opponent.name} has enough threat to punish a loose opening, but the matchup is still manageable with discipline.`
        : `${managedPlayer.name} carries the stronger baseline profile, so the priority is avoiding needless volatility.`;

  return {
    level,
    strengths,
    matchupSummary
  };
}

export function summarizeTacticPlan(player: Player, tactic: MatchTactic) {
  const profile = deriveProfile(player);

  if (tactic.pressurePattern === "all_out_attack") {
    return {
      title: "Front-load initiative.",
      summary: `Best when ${player.name} can convert ${Math.round(profile.attackPressure)} pressure into short rallies before stamina fades.`
    };
  }

  if (tactic.pressurePattern === "wide_pressure") {
    return {
      title: "Stretch the court.",
      summary: `This plan leans on movement and recovery to turn the opponent's base into a problem over time.`
    };
  }

  if (tactic.pressurePattern === "defensive_absorb") {
    return {
      title: "Lower the temperature.",
      summary: `Use composure and rally tolerance to survive pressure and invite overhit errors.`
    };
  }

  return {
    title: "Win the controlled exchanges.",
    summary: `Placement, front-court command, and calmer tempo should keep the match inside readable margins.`
  };
}

export function summarizeMomentum(momentum: number) {
  if (momentum >= 68) {
    return "High";
  }

  if (momentum <= 36) {
    return "Declining";
  }

  return "Stable";
}

export function telemetryForCompetitor(
  player: Player,
  state: LiveCompetitorState,
  setsWon: number
) {
  return {
    playerName: player.name,
    stamina: Math.round(state.stamina),
    momentum: Math.round(state.momentum),
    momentumLabel: summarizeMomentum(state.momentum),
    errors: state.errors,
    smashPeakKph: Math.round(state.smashPeakKph),
    setLead: setsWon
  };
}

export function summarizeRun(tournament: TournamentState, managedPlayer: Player) {
  const results = tournament.managedResults;
  const matchesWon = results.filter((result) => result.won).length;
  const totalSmashes = results.reduce((sum, result) => sum + result.stats.totalSmashes, 0);
  const peakSmash = results.reduce(
    (max, result) => Math.max(max, result.stats.peakSmashSpeed),
    0
  );
  const longestRally = results.reduce(
    (max, result) => Math.max(max, result.stats.longestRally),
    0
  );
  const staminaLoad = results.reduce((sum, result) => sum + result.stats.staminaDrain, 0);

  const wonTitle = tournament.championId === managedPlayer.id;
  const headline = wonTitle ? "Tournament Winner" : "Tournament Recap";
  const summary =
    wonTitle
      ? `A composed run from ${managedPlayer.name}. The managed side survived every bracket pressure point and closed the title.`
      : `${managedPlayer.name} exits the draw, but the run still shows where the tactical plan held and where the match load became too much.`;

  return {
    headline,
    summary,
    telemetry: [
      { label: "Matches Won", value: String(matchesWon) },
      { label: "Total Smashes", value: String(totalSmashes) },
      { label: "Peak Smash", value: peakSmash > 0 ? `${peakSmash} km/h` : "N/A" },
      { label: "Longest Rally", value: longestRally > 0 ? `${longestRally} shots` : "N/A" },
      { label: "Endurance Load", value: `${staminaLoad}` }
    ]
  };
}

export function managedSideLabel(side: Side, leftName: string, rightName: string) {
  return side === "A" ? leftName : rightName;
}
