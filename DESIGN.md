---
name: Industrial Verification Logic
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353438'
  on-surface: '#e4e1e6'
  on-surface-variant: '#cfc2d6'
  inverse-surface: '#e4e1e6'
  inverse-on-surface: '#303033'
  outline: '#988d9f'
  outline-variant: '#4d4354'
  surface-tint: '#ddb7ff'
  primary: '#ddb7ff'
  on-primary: '#490080'
  primary-container: '#b76dff'
  on-primary-container: '#400071'
  inverse-primary: '#842bd2'
  secondary: '#c8c6c9'
  on-secondary: '#303033'
  secondary-container: '#47464a'
  on-secondary-container: '#b6b4b8'
  tertiary: '#fabc4e'
  on-tertiary: '#432c00'
  tertiary-container: '#bd871a'
  on-tertiary-container: '#3a2600'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#f0dbff'
  primary-fixed-dim: '#ddb7ff'
  on-primary-fixed: '#2c0051'
  on-primary-fixed-variant: '#6900b3'
  secondary-fixed: '#e4e1e5'
  secondary-fixed-dim: '#c8c6c9'
  on-secondary-fixed: '#1b1b1e'
  on-secondary-fixed-variant: '#47464a'
  tertiary-fixed: '#ffdead'
  tertiary-fixed-dim: '#fabc4e'
  on-tertiary-fixed: '#281900'
  on-tertiary-fixed-variant: '#604100'
  background: '#131316'
  on-background: '#e4e1e6'
  surface-variant: '#353438'
  success: '#22c55e'
  warning: '#eab308'
  critical: '#ef4444'
  text-main: '#fafafa'
  text-muted: '#a1a1aa'
  border-subtle: '#3f3f46'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  container-padding: 16px
  element-gap: 8px
  section-margin: 24px
  touch-target-min: 44px
---

## Brand & Style

This design system is engineered for high-utility warehouse environments where speed, accuracy, and legibility are paramount. The brand personality is **Industrial and Professional**, stripping away all decorative "AI-style" flourishes in favor of a tool-first aesthetic inspired by high-performance engineering software like Linear or GitHub.

The visual style is **Corporate / Modern** with a focus on high-density information display. It utilizes a strict dark mode palette to reduce eye strain in warehouse lighting, high-contrast status signaling for immediate error detection, and a rigid grid structure. There are no gradients, no floating glass effects, and no oversized elements. Every pixel serves a functional purpose for delivery verification.

## Colors

The palette follows the "Graphite Pro" specification, optimized for deep contrast and functional signaling. 

- **Primary (#a855f7):** Used strictly for primary actions and active states. 
- **Background (#18181b):** The base layer for the application.
- **Surface (#27272a):** Used for cards, inputs, and distinct UI sections to create subtle containment.
- **Functional Colors:** Green (#22c55e), Yellow (#eab308), and Red (#ef4444) are used exclusively for status badges and verification states. 

Avoid any color usage that doesn't convey state or hierarchy. Text must remain at `#fafafa` for maximum readability against dark surfaces.

## Typography

The typography system prioritizes scanning efficiency. **Hanken Grotesk** provides a clean, professional sans-serif feel for primary information, while **JetBrains Mono** is utilized for technical data (tracking numbers, SKUs, timestamps) to ensure character distinction.

- **Headlines:** Keep sizes modest. Do not exceed 24px. Hierarchy is established through weight, not dramatic size shifts.
- **Data Entry:** All SKU and ID displays must use the `label-md` or `label-sm` roles to ensure "0" and "O" or "1" and "l" are clearly distinguishable.
- **Alignment:** Always left-aligned. No centered text in data-heavy views.

## Layout & Spacing

This is a **fluid grid** layout designed for mobile efficiency. It utilizes a dense, functional rhythm that maximizes screen real estate for verification lists.

- **Standard Padding:** A strict 16px margin is applied to the main container.
- **Vertical Rhythm:** Use 8px increments (4/8/12/16/24). 
- **Density:** Information density should be high. Lists should utilize 8px gaps between items to allow more items to be visible above the fold.
- **Mobile First:** Content should reflow vertically. Avoid multi-column layouts on mobile unless displaying short, paired key-value data (e.g., "Weight: 12kg").

## Elevation & Depth

Depth is communicated through **Tonal Layers** and **Solid Borders**, never through dramatic shadows or blurs.

- **Layers:** Use `#18181b` for the canvas and `#27272a` for elevated elements like cards or modals.
- **Borders:** Every interactive or containing element (inputs, cards, buttons) must have a 1px solid border using `#3f3f46`.
- **Shadows:** If used for modals, they must be subtle: `0 2px 8px rgba(0,0,0,0.4)`. No colored shadows or high-blur glows.

## Shapes

The shape language is rigid and industrial. A **Soft (8px)** radius is the maximum allowed for any element.

- **Standard Radius:** 4px for small elements (checkboxes, tags).
- **Component Radius:** 8px for buttons, cards, and input fields.
- **Banned:** Pill-shaped buttons and oversized (12px+) corners are strictly prohibited.

## Components

### Buttons
- **Primary:** Solid `#a855f7` background, `#fafafa` text. 8px radius.
- **Secondary:** Surface background (`#27272a`) with a 1px solid border (`#3f3f46`).
- **State:** No transform or scale animations. Only simple background color shifts on press.

### Inputs & Verification Fields
- **Fields:** Solid `#18181b` background with a 1px border. On focus, the border changes to the primary color.
- **Labels:** Standard labels above the field. No floating label animations.

### Cards & List Items
- **Containers:** 1px solid border, `#27272a` background.
- **Status:** Use the high-contrast functional colors for a 4px left-edge border or a solid corner badge to indicate verification status (Success/Warning/Critical).

### Chips & Badges
- **Style:** Small text, 4px radius, solid background using functional colors. No glows or gradients.

### Lists
- **Structure:** Left-aligned, high-density rows with 1px border separators. Each row should have a minimum touch height of 44px for warehouse glove compatibility.