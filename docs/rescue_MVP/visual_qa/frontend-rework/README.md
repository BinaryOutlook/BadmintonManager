# Frontend Rework Visual Reference

This folder preserves the imagegen design board used to guide the shared frontend rework.

## Direction

- Treat Badminton Manager as a serious coach operating system rather than an athlete-action game.
- Use a near-black and graphite foundation with warm off-white type and court-green emphasis.
- Keep the shell compact: persistent command bar, grouped command rail, and dense information panels.
- Give launch, career, player dossier, tournament, and live-match surfaces distinct jobs while retaining one design language.
- Prefer fine borders, restrained depth, explicit state labels, and useful data density over oversized cards or decorative dashboards.

## Generated Reference

[`imagegen-design-board.png`](imagegen-design-board.png) was generated with the built-in image generation tool as a high-fidelity `ui-mockup` reference. It presents launch/save selection, Career Command Center, player dossier, and live-match command-center concepts in one coordinated board.

The implementation adapts the board to the existing product contracts instead of copying generated text, fictional controls, or unsupported gameplay concepts.

## Implementation Proof

The numbered screenshots in this folder cover the launch screen, athlete-selection overlay, Career Command Center, Calendar, Rankings, Squad, Player Profile, Save Manager, and mobile launch layout. The automated browser suite additionally verifies the redesigned shell and major pages at desktop and mobile sizes.
