# TIX-012 Topbar Hierarchy Visual QA

Captured with:

```bash
FOCUSED_SCREENSHOT_DIR=docs/rescue_MVP/visual_qa/TIX-012 \
  npx playwright test e2e/app.spec.ts -g "keeps the compact Career Portal bounded"
```

Screenshots cover the career shell topbar at `2048x1152`, `1440x900`, `1366x768`, and `390x844`.

Visual checks:

- managed athlete sits directly after the `BM` brand mark
- date and daily CTA form the career clock cluster before save/settings
- `Intel` is absent from the topbar
- desktop and mobile layouts report no horizontal document overflow
