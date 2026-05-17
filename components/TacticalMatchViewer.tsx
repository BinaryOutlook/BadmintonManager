import type { CSSProperties } from "react";
import type { TacticalViewerFrame, TacticalViewerZone } from "../game/career/models.js";

interface TacticalMatchViewerProps {
  frame: TacticalViewerFrame | null;
  title: string;
  statusLabel: string;
}

const zoneNames: Record<TacticalViewerZone["zone"], string> = {
  front_left: "Front L",
  front_center: "Front C",
  front_right: "Front R",
  mid_left: "Mid L",
  mid_center: "Mid C",
  mid_right: "Mid R",
  back_left: "Back L",
  back_center: "Back C",
  back_right: "Back R"
};

const zoneProse: Record<TacticalViewerZone["zone"], string> = {
  front_left: "front left",
  front_center: "front center",
  front_right: "front right",
  mid_left: "mid left",
  mid_center: "mid center",
  mid_right: "mid right",
  back_left: "rear left",
  back_center: "rear center",
  back_right: "rear right"
};

const zoneOrder: TacticalViewerZone["zone"][] = [
  "front_left",
  "front_center",
  "front_right",
  "mid_left",
  "mid_center",
  "mid_right",
  "back_left",
  "back_center",
  "back_right"
];

function zoneStyle(zone: TacticalViewerZone): CSSProperties {
  const intensity = Math.max(zone.pressure, zone.strain, Math.abs(zone.momentumSwing));
  const alpha = 0.08 + intensity / 180;
  const borderAlpha = 0.16 + intensity / 150;

  return {
    "--zone-alpha": String(Math.min(0.72, alpha)),
    "--zone-border-alpha": String(Math.min(0.82, borderAlpha))
  } as CSSProperties;
}

function zoneClass(zone: TacticalViewerZone) {
  if (zone.momentumSwing >= 12) {
    return "tactical-court-zone tactical-court-zone-managed";
  }

  if (zone.momentumSwing <= -12) {
    return "tactical-court-zone tactical-court-zone-opponent";
  }

  return "tactical-court-zone";
}

function metricLabel(value: number) {
  if (value >= 72) {
    return "High";
  }

  if (value >= 46) {
    return "Moderate";
  }

  return "Low";
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function zoneBand(zone: TacticalViewerZone["zone"]) {
  if (zone.startsWith("front")) {
    return "front court";
  }

  if (zone.startsWith("back")) {
    return "rear court";
  }

  return "mid court";
}

function zoneStatus(zone: TacticalViewerZone) {
  if (zone.shots === 0) {
    return "Idle";
  }

  if (zone.momentumSwing <= -12) {
    return "Problem";
  }

  if (zone.momentumSwing >= 12) {
    return "Winning";
  }

  if (zone.pressure >= 70 || zone.pressure + zone.strain >= 112) {
    return "Danger";
  }

  if (zone.pressure >= 52 || zone.strain >= 52) {
    return "Target";
  }

  return "Neutral";
}

function sortByTacticalHeat(left: TacticalViewerZone, right: TacticalViewerZone) {
  const leftHeat = left.pressure * 1.12 + left.strain + Math.abs(left.momentumSwing) * 0.35;
  const rightHeat = right.pressure * 1.12 + right.strain + Math.abs(right.momentumSwing) * 0.35;

  return rightHeat - leftHeat;
}

function tacticalRead(frame: TacticalViewerFrame | null, activeZones: TacticalViewerZone[]) {
  if (!frame || frame.sequence === 0 || activeZones.length === 0) {
    return "Rally evidence will populate once the next point creates a shot pattern.";
  }

  const hotZone = [...activeZones].sort(sortByTacticalHeat)[0];
  const losingZone = [...activeZones].sort((left, right) => left.momentumSwing - right.momentumSwing)[0];
  const winningZone = [...activeZones].sort((left, right) => right.momentumSwing - left.momentumSwing)[0];

  if (losingZone && losingZone.momentumSwing <= -12 && hotZone) {
    return `Opponent is winning the ${zoneBand(losingZone.zone)}. ${capitalize(zoneProse[hotZone.zone])} shots are still creating attack value, but loose ${zoneBand(losingZone.zone)} replies are giving them initiative.`;
  }

  if (winningZone && winningZone.momentumSwing >= 12 && hotZone) {
    return `Your ${zoneBand(winningZone.zone)} pattern is working. Keep using ${zoneProse[hotZone.zone]} to turn movement load into attack chances.`;
  }

  if (hotZone) {
    return `${capitalize(zoneProse[hotZone.zone])} is the clearest rally pattern so far. Build one safer reply behind it before increasing the tempo.`;
  }

  return frame.summary;
}

function bestAdjustment(frame: TacticalViewerFrame | null, activeZones: TacticalViewerZone[]) {
  if (!frame || frame.sequence === 0 || activeZones.length === 0) {
    return "Establish one safe length pattern, then read which front or rear zone starts producing weak replies.";
  }

  const hotZone = [...activeZones].sort(sortByTacticalHeat)[0];
  const losingZone = [...activeZones].sort((left, right) => left.momentumSwing - right.momentumSwing)[0];

  if (losingZone && losingZone.momentumSwing <= -12 && hotZone) {
    return `Play safer lifts after pressure around ${zoneProse[losingZone.zone]}, then target ${zoneProse[hotZone.zone]}.`;
  }

  if (hotZone && hotZone.pressure >= 52) {
    return `Repeat the ${zoneProse[hotZone.zone]} pattern, then cover the next ${zoneBand(hotZone.zone)} reply before it becomes a counter.`;
  }

  return "Keep the next two rallies lower-risk until a clearer attack-value zone appears.";
}

function rallyControlLabel(frame: TacticalViewerFrame | null) {
  if (!frame) {
    return "Level 50 / 100";
  }

  return `${frame.momentum >= 50 ? "Managed" : "Opponent"} ${frame.momentum} / 100`;
}

export function TacticalMatchViewer(props: TacticalMatchViewerProps) {
  const zones = new Map((props.frame?.zones ?? []).map((zone) => [zone.zone, zone]));
  const timeline = props.frame?.momentumTimeline.slice(-10) ?? [];
  const activeZones = props.frame?.zones.filter((zone) => zone.shots > 0) ?? [];
  const read = tacticalRead(props.frame, activeZones);
  const adjustment = bestAdjustment(props.frame, activeZones);
  const contextLine =
    props.frame?.turningPoint ??
    (props.frame?.tacticMarkers.join(" / ") || "Court evidence will populate from rally events.");

  return (
    <section className="tactical-viewer" data-testid="tactical-viewer" aria-label={props.title}>
      <div className="panel-header">
        <h2>{props.title}</h2>
        <span>{props.statusLabel}</span>
      </div>

      <div className="tactical-viewer-layout">
        <div className="tactical-court-wrap">
          <div className="tactical-court" data-testid="tactical-court-map">
            {zoneOrder.map((zoneId) => {
              const zone = zones.get(zoneId) ?? {
                zone: zoneId,
                shots: 0,
                managedShots: 0,
                opponentShots: 0,
                winners: 0,
                errors: 0,
                pressure: 0,
                strain: 0,
                momentumSwing: 0
              };

              return (
                <div
                  key={zoneId}
                  className={zoneClass(zone)}
                  style={zoneStyle(zone)}
                  data-zone={zoneId}
                >
                  <span>{zoneNames[zoneId]}</span>
                  <strong>{zoneStatus(zone)}</strong>
                  <small>
                    Attack {zone.pressure} / Load {zone.strain}
                  </small>
                  <em>{zone.shots} shots</em>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tactical-viewer-rail">
          <div className="tactical-metric-grid">
            <div>
              <span>Attack Value</span>
              <strong>{props.frame?.pressure ?? 0}</strong>
              <small>{metricLabel(props.frame?.pressure ?? 0)}</small>
            </div>
            <div>
              <span>Movement Load</span>
              <strong>{props.frame?.movementStrain ?? 0}</strong>
              <small>{metricLabel(props.frame?.movementStrain ?? 0)}</small>
            </div>
            <div>
              <span>Rally Control</span>
              <strong>{props.frame?.momentum ?? 50}</strong>
              <small>{rallyControlLabel(props.frame)}</small>
            </div>
          </div>

          <div className="tactical-summary-block">
            <span>Tactical Read</span>
            <strong>{read}</strong>
            <p>{contextLine}</p>
          </div>

          <div className="tactical-summary-block tactical-adjustment-block">
            <span>Best Adjustment</span>
            <strong>{adjustment}</strong>
          </div>

          <div className="tactical-timeline" data-testid="tactical-momentum-timeline">
            {timeline.length > 0 ? (
              timeline.map((entry) => (
                <span
                  key={`${entry.sequence}-${entry.score}`}
                  style={{ height: `${Math.max(12, entry.momentum)}%` }}
                  title={`${entry.score}: ${entry.momentum} rally control`}
                />
              ))
            ) : (
              <span className="tactical-timeline-empty" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
