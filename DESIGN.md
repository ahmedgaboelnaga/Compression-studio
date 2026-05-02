<!-- SEED — re-run $impeccable document once there's code to capture the actual tokens and components. -->
---
name: Multimedia Compression UI
description: A clean, modern, and interactive demonstration of lossless compression algorithms.
---

# Design System: Multimedia Compression UI

## 1. Overview

**Creative North Star: "The Editorial Interface"**

This system marries the high-utility precision of Notion with the refined elegance of a modern editorial magazine. It is designed to make complex mathematical algorithms feel accessible, clear, and beautiful. The density is comfortable, leveraging ample whitespace to let the data and typographic choices breathe. It explicitly rejects the cluttered, generic look of academic dashboards or Streamlit prototypes. 

**Key Characteristics:**
- Typography-led hierarchy.
- Restrained color palette with highly deliberate, minimal accents.
- Purposeful, responsive motion that guides the user's eye.
- Absolute clarity of information (before/after states).

## 2. Colors

The color palette is highly disciplined, relying on tinted neutrals and a single, carefully chosen accent color. 

**The Restrained Rule.** The accent color must never occupy more than 10% of any given screen. Its rarity is exactly what gives it power and draws attention to the compression results.

### Primary
- **Accent Color** ([to be resolved during implementation]): Used strictly for primary actions and highlighting the compression ratio improvements.

### Neutral
- **Backgrounds & Text** ([to be resolved during implementation]): Tinted neutrals (off-whites, deep charcoal grays) to provide a soft, high-contrast reading environment without the harshness of pure black `#000` or pure white `#fff`.

## 3. Typography

**Display Font:** [font pairing to be chosen at implementation — likely a highly refined Serif or bold Geometric]
**Body Font:** [clean Sans-serif to be chosen at implementation]

**Character:** A highly creative pairing that feels both deeply academic and remarkably modern. The contrast between the striking display headers and the perfectly legible body text creates immediate visual interest.

### Hierarchy
- **Display** ([weight], [size/clamp], [line-height]): Used for algorithm titles and major statistical callouts.
- **Headline** ([weight], [size], [line-height]): Used for section headers (e.g., "Original Stream", "Compressed Output").
- **Body** ([weight], [size], [line-height]): Used for explanations and raw data. Capped at 65–75ch for optimal reading.
- **Label** ([weight], [size], [letter-spacing]): Used for UI controls, dropdowns, and button text.

## 4. Elevation

Because the motion energy is responsive and partially choreographed, the system uses subtle layering. Surfaces are mostly flat at rest, but elevate with soft, ambient shadows during interaction or to highlight the focal point (the active compression output).

## 6. Do's and Don'ts

### Do:
- **Do** use typography scale and weight contrast to establish hierarchy, rather than relying on boxes or lines.
- **Do** choreograph motion so that the transition from "Original" to "Compressed" feels magical but mathematically precise.
- **Do** ensure every neutral color is slightly tinted towards the brand hue to avoid dead grays.

### Don't:
- **Don't** use Streamlit-style generic data dashboards.
- **Don't** build bulky, unstyled "academic project" interfaces.
- **Don't** use identical card grids or cluttered, over-engineered layouts.
- **Don't** use pure black `#000000` or pure white `#FFFFFF`.
- **Don't** animate CSS layout properties; stick to transforms and opacity for smooth performance.
