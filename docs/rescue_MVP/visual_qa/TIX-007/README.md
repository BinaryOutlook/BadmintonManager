# TIX-007 Visual QA Artifacts

Captured with `FOCUSED_SCREENSHOT_DIR=docs/rescue_MVP/visual_qa/TIX-007 npx playwright test e2e/app.spec.ts`.

## Required launch states

- `start-empty-desktop.png`
- `start-empty-mobile.png`
- `start-career-save-desktop.png`
- `start-career-save-mobile.png`
- `start-quick-save-desktop.png`
- `start-recovery-warning-desktop.png`

## Inspection notes

- The active saved-career and saved-tournament panels make the continue action the only strongest green launch command.
- No-save launch keeps `Start Career` primary and `Quick Tournament` prominent without rendering an empty resume panel.
- Recovery appears once as a compact strip before the launch choices.
- Desktop and mobile captures were paired with Playwright launch overflow assertions.
