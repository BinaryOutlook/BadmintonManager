import { describe, expect, it } from "vitest";
import { seededPlayers } from "../../game/content/players";
import {
  applyTeamTalk,
  createMatchSession,
  simulateMatch,
  simulateNextPoint,
  simulateQuickMatch,
  simulateUntilSetComplete
} from "../../game/core/match";
import type { MatchInput, MatchTactic, TacticModule } from "../../game/core/models";
import { deriveTacticRuntimeProfile } from "../../game/core/tactics";
import { CURRENT_SAVE_VERSION, persistedSaveSchema } from "../../game/store/save";

function advancedTactic(overrides: {
  tempo?: number;
  rearCourtPressure?: number;
  netPriority?: number;
  riskTolerance?: number;
  rallyLengthIntent?: "shorten" | "balanced" | "extend";
  modules?: TacticModule[];
} = {}): MatchTactic {
  return {
    label: "Exact Intent",
    tempo: "fast",
    pressurePattern: "all_out_attack",
    riskProfile: "high_risk",
    advancedIntent: {
      version: 1,
      tempo: overrides.tempo ?? 75,
      rearCourtPressure: overrides.rearCourtPressure ?? 76,
      netPriority: overrides.netPriority ?? 45,
      riskTolerance: overrides.riskTolerance ?? 66,
      rallyLengthIntent: overrides.rallyLengthIntent ?? "shorten",
      modules: overrides.modules ?? []
    }
  };
}

function matchInput(tacticA: MatchTactic, seed: number): MatchInput {
  return {
    seed,
    playerA: seededPlayers[0].player,
    playerB: seededPlayers[1].player,
    tacticA,
    tacticB: {
      label: "Legacy Balance",
      tempo: "balanced",
      pressurePattern: "backhand_pressure",
      riskProfile: "standard"
    }
  };
}

function moduleTactic(modules: TacticModule[]): MatchTactic {
  return {
    label: modules.join("+") || "Neutral Exact Intent",
    tempo: "balanced",
    pressurePattern: "backhand_pressure",
    riskProfile: "standard",
    advancedIntent: {
      version: 1,
      tempo: 50,
      rearCourtPressure: 50,
      netPriority: 50,
      riskTolerance: 50,
      rallyLengthIntent: "balanced",
      modules
    }
  };
}

describe("advanced tactic runtime profile", () => {
  it("keeps legacy tactics on an exact neutral runtime overlay", () => {
    const profile = deriveTacticRuntimeProfile({
      label: "Legacy",
      tempo: "balanced",
      pressurePattern: "front_court_control",
      riskProfile: "standard"
    });

    expect(profile).toMatchObject({
      advanced: false,
      attackBonus: 0,
      staminaBurnMultiplier: 1,
      riskDifficulty: 0,
      rallyStressMultiplier: 1,
      expectedRallyDelta: 0,
      quickPointEdge: 0
    });
    expect(Object.values(profile.shotWeightDeltas).every((value) => value === 0)).toBe(true);
  });

  it("maps every module to the engine dimension promised by the planning UI", () => {
    const neutral = deriveTacticRuntimeProfile(advancedTactic({
      tempo: 50,
      rearCourtPressure: 50,
      netPriority: 50,
      riskTolerance: 50,
      rallyLengthIntent: "balanced"
    }));
    const targetBackhand = deriveTacticRuntimeProfile(advancedTactic({ modules: ["target_backhand"] }));
    const netTrap = deriveTacticRuntimeProfile(advancedTactic({ modules: ["net_trap"] }));
    const rearLock = deriveTacticRuntimeProfile(advancedTactic({ modules: ["rear_court_lock"] }));
    const bodySmash = deriveTacticRuntimeProfile(advancedTactic({ modules: ["body_smash"] }));
    const safeLift = deriveTacticRuntimeProfile(advancedTactic({ modules: ["safe_lift_release"] }));

    expect(targetBackhand.backhandZoneWeight).toBeGreaterThan(neutral.backhandZoneWeight);
    expect(netTrap.frontZoneWeight).toBeGreaterThan(neutral.frontZoneWeight);
    expect(netTrap.shotWeightDeltas.net).toBeGreaterThan(neutral.shotWeightDeltas.net);
    expect(rearLock.backZoneWeight).toBeGreaterThan(neutral.backZoneWeight);
    expect(bodySmash.bodyZoneWeight).toBeGreaterThan(neutral.bodyZoneWeight);
    expect(bodySmash.shotWeightDeltas.smash).toBeGreaterThan(neutral.shotWeightDeltas.smash);
    expect(bodySmash.staminaBurnMultiplier).toBeGreaterThan(neutral.staminaBurnMultiplier);
    expect(safeLift.shotWeightDeltas.lift).toBeGreaterThan(neutral.shotWeightDeltas.lift);
    expect(safeLift.riskDifficulty).toBeLessThan(neutral.riskDifficulty);
  });

  it("maps every exact slider and rally intent to a bounded runtime direction", () => {
    const neutral = deriveTacticRuntimeProfile(advancedTactic({
      tempo: 50,
      rearCourtPressure: 50,
      netPriority: 50,
      riskTolerance: 50,
      rallyLengthIntent: "balanced"
    }));
    const faster = deriveTacticRuntimeProfile(advancedTactic({ tempo: 80 }));
    const deeper = deriveTacticRuntimeProfile(advancedTactic({ rearCourtPressure: 80 }));
    const tighterNet = deriveTacticRuntimeProfile(advancedTactic({ netPriority: 80 }));
    const riskier = deriveTacticRuntimeProfile(advancedTactic({ riskTolerance: 80 }));
    const extended = deriveTacticRuntimeProfile(advancedTactic({ rallyLengthIntent: "extend" }));
    const shortened = deriveTacticRuntimeProfile(advancedTactic({ rallyLengthIntent: "shorten" }));

    expect(faster.attackBonus).toBeGreaterThan(neutral.attackBonus);
    expect(faster.staminaBurnMultiplier).toBeGreaterThan(neutral.staminaBurnMultiplier);
    expect(deeper.backZoneWeight).toBeGreaterThan(neutral.backZoneWeight);
    expect(deeper.shotWeightDeltas.smash).toBeGreaterThan(neutral.shotWeightDeltas.smash);
    expect(tighterNet.frontZoneWeight).toBeGreaterThan(neutral.frontZoneWeight);
    expect(tighterNet.shotWeightDeltas.net).toBeGreaterThan(neutral.shotWeightDeltas.net);
    expect(riskier.riskDifficulty).toBeGreaterThan(neutral.riskDifficulty);
    expect(extended.expectedRallyDelta).toBeGreaterThan(neutral.expectedRallyDelta);
    expect(extended.rallyStressMultiplier).toBeLessThan(neutral.rallyStressMultiplier);
    expect(shortened.expectedRallyDelta).toBeLessThan(neutral.expectedRallyDelta);
    expect(shortened.rallyStressMultiplier).toBeGreaterThan(neutral.rallyStressMultiplier);
  });

  it("produces module-specific court and shot evidence across a fixed seed band", () => {
    const aggregate = (tactic: MatchTactic) => {
      let actorShots = 0;
      let backhandZones = 0;
      let frontZones = 0;
      let backZones = 0;
      let bodyZones = 0;
      let netConstruction = 0;
      let smashes = 0;
      let safeShots = 0;

      for (let seed = 9400; seed < 9420; seed += 1) {
        const input = matchInput(tactic, seed);
        const result = simulateMatch(input);
        const backhandSide = input.playerB.handedness === "right" ? "left" : "right";
        const shots = result.setSummaries.flatMap((set) => set.points.flatMap((point) => point.shots)).filter((shot) => shot.actor === "A");

        actorShots += shots.length;
        backhandZones += shots.filter((shot) => shot.targetZone.endsWith(backhandSide)).length;
        frontZones += shots.filter((shot) => shot.targetZone.startsWith("front")).length;
        backZones += shots.filter((shot) => shot.targetZone.startsWith("back")).length;
        bodyZones += shots.filter((shot) => shot.targetZone === "mid_center").length;
        netConstruction += shots.filter((shot) => shot.shotType === "net" || shot.shotType === "drop").length;
        smashes += shots.filter((shot) => shot.shotType === "smash").length;
        safeShots += shots.filter((shot) => shot.shotType === "clear" || shot.shotType === "lift" || shot.shotType === "block").length;
      }

      return {
        backhandRate: backhandZones / actorShots,
        frontRate: frontZones / actorShots,
        backRate: backZones / actorShots,
        bodyRate: bodyZones / actorShots,
        netConstructionRate: netConstruction / actorShots,
        smashRate: smashes / actorShots,
        safeShotRate: safeShots / actorShots
      };
    };
    const neutral = aggregate(moduleTactic([]));

    expect(aggregate(moduleTactic(["target_backhand"])).backhandRate).toBeGreaterThan(neutral.backhandRate);
    const netTrap = aggregate(moduleTactic(["net_trap"]));
    const rearLock = aggregate(moduleTactic(["rear_court_lock"]));
    const bodySmash = aggregate(moduleTactic(["body_smash"]));
    const safeLift = aggregate(moduleTactic(["safe_lift_release"]));

    expect(netTrap.frontRate).toBeGreaterThan(neutral.frontRate);
    expect(netTrap.netConstructionRate).toBeGreaterThan(neutral.netConstructionRate);
    expect(rearLock.backRate).toBeGreaterThan(neutral.backRate);
    expect(bodySmash.bodyRate).toBeGreaterThan(neutral.bodyRate);
    expect(bodySmash.smashRate).toBeGreaterThan(neutral.smashRate);
    expect(safeLift.safeShotRate).toBeGreaterThan(neutral.safeShotRate);
  });

  it("keeps exact intent deterministic in detailed and quick simulation", () => {
    const tactic = advancedTactic({
      tempo: 88,
      rearCourtPressure: 91,
      riskTolerance: 84,
      modules: ["rear_court_lock", "body_smash"]
    });
    const input = matchInput(tactic, 9301);

    expect(simulateMatch(input)).toEqual(simulateMatch(input));
    expect(simulateQuickMatch(input)).toEqual(simulateQuickMatch(input));
  });

  it("round-trips exact intent in a mid-match save without changing the next point", () => {
    const input = matchInput(advancedTactic({
      tempo: 84,
      rearCourtPressure: 89,
      netPriority: 58,
      riskTolerance: 78,
      modules: ["target_backhand", "body_smash"]
    }), 9302);
    const session = simulateNextPoint(createMatchSession(input));
    const save = persistedSaveSchema.parse(JSON.parse(JSON.stringify({
      version: CURRENT_SAVE_VERSION,
      selectedPlayerId: input.playerA.id,
      plannedTacticKey: "balancedControl",
      seed: input.seed,
      tournament: null,
      liveMatch: {
        matchId: "intent-round-trip",
        roundName: "R16",
        managedSide: "A",
        opponentName: input.playerB.name,
        opponentTacticLabel: input.tacticB.label,
        session
      },
      career: null
    })));

    expect(save.liveMatch?.session.input.tacticA.advancedIntent).toEqual(input.tacticA.advancedIntent);
    expect(JSON.parse(JSON.stringify(simulateNextPoint(save.liveMatch!.session)))).toEqual(
      JSON.parse(JSON.stringify(simulateNextPoint(session)))
    );
  });

  it("keeps between-set tempo talks effective for exact-intent tactics", () => {
    const input = matchInput(advancedTactic({ tempo: 86 }), 9303);
    const intermission = simulateUntilSetComplete(createMatchSession(input));
    const talked = applyTeamTalk(intermission, "A", "calm_down");
    const resumed = simulateNextPoint(talked);

    expect(resumed.competitorA.tactic.tempo).toBe("conserve");
    expect(resumed.competitorA.tactic.advancedIntent?.tempo).toBe(26);
  });

  it("changes match shape for slider edits that stay inside the same categorical tactic", () => {
    const lowerIntent = advancedTactic({
      tempo: 68,
      rearCourtPressure: 75,
      netPriority: 45,
      riskTolerance: 64,
      modules: ["rear_court_lock"]
    });
    const higherIntent = advancedTactic({
      tempo: 94,
      rearCourtPressure: 95,
      netPriority: 45,
      riskTolerance: 94,
      modules: ["rear_court_lock"]
    });

    const aggregate = (tactic: MatchTactic) => {
      let smashes = 0;
      let errors = 0;
      let staminaDrain = 0;
      let points = 0;

      for (let seed = 9310; seed < 9322; seed += 1) {
        const result = simulateMatch(matchInput(tactic, seed));
        smashes += result.stats.totalSmashesA;
        errors += result.stats.unforcedErrorsA;
        staminaDrain += result.stats.staminaDrainA;
        points += result.stats.totalPoints;
      }

      return {
        smashRate: smashes / points,
        errorRate: errors / points,
        staminaDrainRate: staminaDrain / points
      };
    };
    const lower = aggregate(lowerIntent);
    const higher = aggregate(higherIntent);

    expect(lowerIntent.tempo).toBe(higherIntent.tempo);
    expect(lowerIntent.pressurePattern).toBe(higherIntent.pressurePattern);
    expect(lowerIntent.riskProfile).toBe(higherIntent.riskProfile);
    expect(higher.errorRate).toBeGreaterThan(lower.errorRate);
    expect(higher.staminaDrainRate).toBeGreaterThan(lower.staminaDrainRate);
    expect(higher).not.toEqual(lower);
  });
});
