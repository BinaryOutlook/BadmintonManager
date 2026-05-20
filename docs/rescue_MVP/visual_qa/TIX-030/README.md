# TIX-030 Player Profile Visual QA

Captured for issue #67 / PR #72 after the Player Profile optimization pass.

## Capture command

```bash
FOCUSED_SCREENSHOT_DIR=docs/rescue_MVP/visual_qa/TIX-030 npx playwright test e2e/app.spec.ts -g "player profile renders decision-first managed and scouting dossiers"
```

## Screenshot pack

| File | Coverage |
| --- | --- |
| `player-profile-managed-overview-desktop.png` | Managed Overview at 1440 × 900 |
| `player-profile-selectable-overview-desktop.png` | Selectable/unmanaged Overview at 1440 × 900 |
| `player-profile-opponent-overview-desktop.png` | Opponent scouting Overview from tournament context |
| `player-profile-attributes-desktop.png` | Attributes tab at desktop width |
| `player-profile-attributes-mobile.png` | Attributes tab at 390 × 844 mobile width |
| `player-profile-performance-empty-desktop.png` | Performance tab empty/locked evidence state |
| `player-profile-performance-telemetry-desktop.png` | Performance tab with managed telemetry evidence |
| `player-profile-career-desktop.png` | Career tab baseline archive state |
| `player-profile-career-h2h-desktop.png` | Career tab with persisted head-to-head rivalry rows |
