import type { CSSProperties } from "react";
import type { TacticalViewerFrame, TacticalViewerZone } from "../game/career/models";

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
    return "Live";
  }

  return "Low";
}

export function TacticalMatchViewer(props: TacticalMatchViewerProps) {
  const zones = new Map((props.frame?.zones ?? []).map((zone) => [zone.zone, zone]));
  const timeline = props.frame?.momentumTimeline.slice(-10) ?? [];

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
                  <strong>{zone.shots}</strong>
                  <small>
                    P{zone.pressure} / S{zone.strain}
                  </small>
                </div>
              );
            })}
          </div>
        </div>

        <div className="tactical-viewer-rail">
          <div className="tactical-metric-grid">
            <div>
              <span>Pressure</span>
              <strong>{props.frame?.pressure ?? 0}</strong>
              <small>{metricLabel(props.frame?.pressure ?? 0)}</small>
            </div>
            <div>
              <span>Strain</span>
              <strong>{props.frame?.movementStrain ?? 0}</strong>
              <small>{metricLabel(props.frame?.movementStrain ?? 0)}</small>
            </div>
            <div>
              <span>Momentum</span>
              <strong>{props.frame?.momentum ?? 50}</strong>
              <small>{props.frame && props.frame.momentum >= 50 ? "Managed" : "Opponent"}</small>
            </div>
          </div>

          <div className="tactical-summary-block">
            <span>Evidence Summary</span>
            <strong>{props.frame?.summary ?? "No tactical evidence captured yet"}</strong>
            <p>{props.frame?.turningPoint ?? props.frame?.tacticMarkers.join(" / ") ?? "Court evidence will populate from rally events."}</p>
          </div>

          <div className="tactical-timeline" data-testid="tactical-momentum-timeline">
            {timeline.length > 0 ? (
              timeline.map((entry) => (
                <span
                  key={`${entry.sequence}-${entry.score}`}
                  style={{ height: `${Math.max(12, entry.momentum)}%` }}
                  title={`${entry.score}: ${entry.momentum} momentum`}
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
