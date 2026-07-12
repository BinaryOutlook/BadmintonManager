# Version Two Responsive Evidence

Captured: 2026-07-13

These screenshots are generated from the current `Version-Two-Update` implementation by the same Playwright scenarios
that assert layout bounds, command reachability, focus behavior, semantic labels, and state-backed content.

```sh
VERSION_TWO_SCREENSHOT_DIR=docs/rescue_MVP/visual_qa/version-two-update \
  npx playwright test e2e/version-two-responsive.spec.ts
```

## Matrix

The evidence covers `320x720`, `768x1024`, `1024x900`, and `1440x900` for:

- Portal shell and mobile navigation drawer;
- My Program;
- Portal schedule snapshot, Timeline commitments, and month Calendar;
- actionable Inbox and read-only Reports;
- Local Career Library overview and active slot card.

The suite checks page-level horizontal overflow, intentional calendar containment, visible command labels, mobile drawer
geometry, focus restoration, identity-label clipping, state-backed schedule destinations, save metadata, and primary
actions. All 12 responsive scenarios passed when this directory was regenerated.

## Visual Review

Representative phone, tablet, compact-desktop, and wide-desktop captures were inspected after generation. The current
checkpoint keeps headings and primary decisions discoverable, stacks save actions at phone width, preserves the full
drawer label set on mobile/tablet, contains the dense calendar, and renders Reports/Save Manager metadata without raw
state identifiers or unsupported mechanics.

This folder is milestone evidence, not a hand-authored design source. The image-generation design reference and the
original implementation comparison remain in `../frontend-rework/`.
