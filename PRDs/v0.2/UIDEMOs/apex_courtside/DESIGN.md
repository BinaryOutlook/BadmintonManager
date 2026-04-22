---
name: Apex Courtside
colors:
  surface: '#111316'
  surface-dim: '#111316'
  surface-bright: '#37393d'
  surface-container-lowest: '#0c0e11'
  surface-container-low: '#1a1c1f'
  surface-container: '#1e2023'
  surface-container-high: '#282a2d'
  surface-container-highest: '#333538'
  on-surface: '#e2e2e6'
  on-surface-variant: '#baccb0'
  inverse-surface: '#e2e2e6'
  inverse-on-surface: '#2f3034'
  outline: '#85967c'
  outline-variant: '#3c4b35'
  surface-tint: '#2ae500'
  primary: '#efffe3'
  on-primary: '#053900'
  primary-container: '#39ff14'
  on-primary-container: '#107100'
  inverse-primary: '#106e00'
  secondary: '#e6feff'
  on-secondary: '#003739'
  secondary-container: '#00f4fe'
  on-secondary-container: '#006c71'
  tertiary: '#f9faff'
  on-tertiary: '#2b3139'
  tertiary-container: '#d8dee8'
  on-tertiary-container: '#5c626b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#79ff5b'
  primary-fixed-dim: '#2ae500'
  on-primary-fixed: '#022100'
  on-primary-fixed-variant: '#095300'
  secondary-fixed: '#63f7ff'
  secondary-fixed-dim: '#00dce5'
  on-secondary-fixed: '#002021'
  on-secondary-fixed-variant: '#004f53'
  tertiary-fixed: '#dde3ed'
  tertiary-fixed-dim: '#c1c7d1'
  on-tertiary-fixed: '#161c23'
  on-tertiary-fixed-variant: '#414750'
  background: '#111316'
  on-background: '#e2e2e6'
  surface-variant: '#333538'
typography:
  h1-bold:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2-bold:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h3-caps:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  body-xs:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: '0'
  data-mono:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-page: 32px
  stack-compact: 8px
  stack-default: 16px
  panel-padding: 20px
---

## Brand & Style

The design system is engineered for the high-stakes environment of professional badminton management. It adopts a **Corporate / Modern** aesthetic fused with the precision of a **Coaching Console**. The atmosphere is one of a "Tournament Command Center"—prioritizing immediate data legibility, tactical analysis, and authoritative control. 

The visual language rejects decorative trends like glassmorphism in favor of structural integrity. It evokes the feeling of professional scouting software and broadcast sports telemetry. The user should feel like an elite strategist rather than a casual player. The brand personality is disciplined, analytical, and relentless.

## Colors

The palette is anchored in deep, "blue-black" and graphite tones to reduce eye strain during long analytical sessions. 

- **Grounded Surfaces:** Use `#121417` for the primary background and `#1A1D21` for layout panels. Secondary containers use `#24292E` to create a tiered hierarchy of information.
- **Functional Accents:** Neon Green (`#39FF14`) is reserved strictly for positive momentum, "Active" statuses, and successful performance metrics. Cyan (`#00F5FF`) is used for technical interactions, interactive elements, and focused states.
- **Borders:** Thin, high-definition borders (`#2D333B`) define the boundaries between data modules without adding visual bulk.

## Typography

The design system utilizes **Inter** for its exceptional legibility in high-density data environments. The typographic scale is optimized for "Information Density," allowing coaches to scan player stats and match history rapidly.

- **Editorial Hierarchy:** Use H3-Caps for section headers to provide a clear structural anchor.
- **Data Density:** Body text is primarily kept at 14px. For dense data tables or secondary meta-info, 12px is preferred.
- **Functional Labels:** Use the `label-caps` style for small descriptors, table headers, and status tags to differentiate them from actionable content.

## Layout & Spacing

This design system follows a **12-column fluid grid** for the main content area, allowing the dashboard to scale across widescreen coaching monitors. 

- **Grid Logic:** Use a 16px gutter to maintain tight information grouping.
- **Rhythm:** All spacing is based on a 4px baseline. Components are grouped using 8px (compact) or 16px (standard) intervals. 
- **Structure:** Content should be organized into modular "Command Panels." These panels act as independent units of data that can be reconfigured based on the coach's workflow.

## Elevation & Depth

Depth is communicated through **Tonal Layering** and **Subtle Shadowing**. Rather than using light sources to create soft "floating" effects, elevation in this system mimics physical overlays in a military console.

- **Base Layer:** `#121417` (The void/canvas).
- **Panel Layer:** `#1A1D21` with a 1px solid border of `#2D333B`.
- **Active Overlay:** Elements that require focus (modals, dropdowns) use `#24292E` and a deep, tight shadow: `0 8px 16px -4px rgba(0,0,0,0.6)`. 
- **Z-Axis:** Depth is defined by increasing the brightness of the surface hex as it "rises" toward the user.

## Shapes

The shape language is **Structured and Geometric**. We avoid large radius curves to maintain a professional, analytical feel.

- **Standard Corners:** 4px radius for small components (buttons, inputs, chips).
- **Panel Corners:** 6px to 8px radius for main dashboard containers and cards.
- **Strictness:** Large elements should never exceed 8px. This preserves the "rigidity" required for a command-center aesthetic.

## Components

- **Buttons:** Primary buttons use a solid fill of `#39FF14` with black text for maximum visibility. Secondary buttons are outlined using `#2D333B` with white text. Tertiary/Ghost buttons use Cyan text with no background.
- **Data Tables:** High-density rows with a 1px bottom border. Alternate row striping is discouraged; use hover-state highlights in `#24292E` instead.
- **Status Chips:** Small, pill-shaped indicators. "Live" matches use a pulsing Cyan dot. "Completed" matches use Neon Green.
- **Input Fields:** Dark backgrounds (`#121417`) with a subtle `#2D333B` border. Focus state triggers a 1px glow of Cyan (`#00F5FF`).
- **Telemetry Cards:** Special components for player stats. These feature a "Tactical Header" using the `h3-caps` typography and integrated sparklines in Cyan or Neon Green.
- **Analytical Gauges:** Circular or linear progress bars for stamina/win-probability, utilizing the Neon Green for positive thresholds.