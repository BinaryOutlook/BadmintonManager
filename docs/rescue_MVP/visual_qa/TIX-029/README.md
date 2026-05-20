# TIX-029 Main Screen Optimization Visual QA

Captured with:

```bash
FOCUSED_SCREENSHOT_DIR=docs/rescue_MVP/visual_qa/TIX-029 \
  npx playwright test e2e/app.spec.ts -g "keeps the compact Career Portal bounded"
```

Screenshots:

- `portal-2048x1152.png` - wide desktop Career Command Center decision hierarchy.
- `portal-1440x900.png` - required desktop laptop viewport.
- `portal-1366x768.png` - compact desktop guardrail from the bounded portal test.
- `portal-mobile.png` - narrow mobile viewport (`390x844`).

Visual checks:

- `Next Decision` is the dominant first-screen work surface.
- `Player Condition` owns readiness while urgent tasks stay compact.
- `Calendar Snapshot` exposes deadline/open schedule pressure instead of defaulting every day to training.
- `Finance Summary` and `Program Ecosystem` remain reachable but stay lower priority.
- The bounded portal test reports no horizontal overflow or first-viewport clipping for desktop targets.
