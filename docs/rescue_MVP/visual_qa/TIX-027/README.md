# TIX-027 Tournament Page Optimization Visual QA

Captured with:

```sh
FOCUSED_SCREENSHOT_DIR=docs/rescue_MVP/visual_qa/TIX-027 \
  npx playwright test e2e/app.spec.ts -g "continues a deterministic career event|integrates fictional calendar ranking stakes"
```

Screenshots:

- `tix-027-tournament-home-desktop-projected.png` - desktop future Tournament Home with the draw surfaced before notes.
- `tix-027-tournament-home-mobile-projected.png` - mobile future Tournament Home.
- `tix-027-active-16-desktop.png` - active 16-player event bracket with compact score cells.
- `tix-027-active-16-mobile.png` - mobile active 16-player event bracket.
- `post-match-next-round-cta.png` - existing post-match continuation proof captured by the focused test path.

The 32-player bracket path is covered through the `KnockoutTree` unit harness because the runtime tournament engine and save schemas still publish 16-player draws by default.
