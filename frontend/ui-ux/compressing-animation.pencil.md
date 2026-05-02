# Compressing Animation Pencil Spec

This file is the Pencil-first handoff for the studio loading animation. The checked-in `design.pen` file is currently empty, so this spec captures the intended Pencil frames and implementation mapping until a real Pencil canvas is exported into the repo.

## Surface

Screen: compression loading state.

Purpose: show readable source symbols being converted into a compact encoded payload without feeling like a generic spinner.

## Pencil Frames

### Frame 1: Source Stream

- Background: warm off-white workspace with a quiet 48px grid.
- Center guide: one thin horizontal rule across the animation lane.
- Left stream: square symbol tokens moving toward the encoder.
- Token content: `T`, `H`, `E`, `SP`, `Q`, `U`, `I`, `C`, `K`.
- Token style: pale surface, thin neutral border, mono label.

### Frame 2: Encoder Core

- Center object: dark square encoder block.
- Inside: compact 0/1 matrix suggesting bit modeling.
- Divider: muted gold horizontal rule.
- Label: `ENCODE`.
- Motion: subtle breathing/brightness pulse only, no bouncing.

### Frame 3: Encoded Stream

- Right stream: dense vertical bit bars leaving the encoder.
- Bars vary in height and opacity to imply compression density.
- Motion: faster than source tokens, communicating compact output.

## Timing

- Source token motion: 1400ms linear loop.
- Encoded bar motion: 700ms linear loop.
- Encoder pulse: 1100ms ease-in-out loop.
- Progress line: 1800ms ease-out fill.

## Accessibility

- Respect `prefers-reduced-motion`.
- Keep all animation decorative; loading text carries the actual status.
- Avoid flashing, bounce, elastic motion, or layout-changing animation.

## Implementation Mapping

- React component: `CompressingScreen` in `frontend/src/App.tsx`.
- CSS keyframes: `tokenTrain`, `bitTrain`, `compressorBreathe` in `frontend/src/index.css`.
- Colors intentionally follow the product's restrained editorial UI direction from `DESIGN.md`.
