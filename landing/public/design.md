# Inboundr

## Overview

This is the design system for Inboundr's marketing site. The aesthetic is dark, editorial, and high-contrast: deep green-black surfaces, generous whitespace, a single gold accent reserved for emphasis, and sharp corners everywhere. Hierarchy comes from type scale and text opacity rather than boxes and shadows. Prioritize readability, keep decoration restrained, and let color signal meaning — never mood.

The site ships one theme (dark). There is no light mode.

## Colors

Tokens are defined as CSS custom properties (Tailwind v4 `@theme`) and used as Tailwind utilities (`bg-base`, `text-text-muted`, `border-border`, and so on):

- `base` `#060906` — page background; the darkest surface and the default canvas.
- `surface` `#0e1310` — hover fills and subtle panel backgrounds.
- `surface-raised` `#151c17` — cards and raised panels; also hover state for green-filled controls.
- `border` `rgba(255, 255, 255, 0.06)` — the only border color; 1px dividers, card outlines, and section separators. Hover states may step up to `rgba(255, 255, 255, 0.1)` (`text/10`) or `text/20`.
- `text` `#edf2ec` — primary text and icons; also the fill of the primary button.
- `text-muted` `rgba(237, 242, 236, 0.5)` — secondary text: body copy, descriptions, nav links.
- `text-dim` `rgba(237, 242, 236, 0.3)` — tertiary text: metadata, separators, de-emphasized labels.
- `green` `#2f5d50` — brand green for opaque fills: banners, the login button, accent panels.
- `green-bright` `#3ecf8e` — state and action color: eyebrow labels, inline links, the scroll progress bar, and the CTA hover glow. Never use it as a large fill.
- `gold` `#efc554` — the emphasis accent: serif display text, text selection, and the focus ring. Use sparingly — roughly one gold moment per view.

Rank information with the text scale: `text` for primary, `text-muted` for secondary, `text-dim` for tertiary. Surfaces stay flat; separation comes from `border`, not elevation.

## Typography

Two families, sharply divided by role:

- **Sora** (variable, sans-serif) sets everything by default: headings, body, labels, buttons.
- **Instrument Serif** (`font-display`) is reserved for display moments — hero lines, pull quotes, feature-name callouts. It is always italic and almost always `gold`.

Conventions:

- Hero headlines pair a light sans line (`font-light`, tracking `-0.04em`) with an italic serif line in gold; sizes are fluid, for example `clamp(3rem, 8vw, 6rem)`.
- Section headings use `font-bold` with tracking `-0.02em` to `-0.03em`; tracking tightens as size grows.
- Body copy is 15–17px, `leading-relaxed`, in `text-muted`; keep measure to `max-w-md`–`max-w-2xl` and use `text-pretty` or `text-balance`.
- Eyebrow labels use the `label` utility: 13px, weight 500, uppercase, letter-spacing `0.3em`. The compact variant `label-sm` is 11px, weight 700, letter-spacing `0.2em`. Labels are colored by intent: `green-bright` for primary sections, `text-muted` or `text-dim` for neutral ones, `gold` for the emphasized one.
- UI chrome (nav links, buttons) is 13–14px, weight 500–600.

Never use Instrument Serif for body text, labels, or controls, and never use it upright — italic only.

## Layout

Structure follows Tailwind's 4px spacing scale. Conventions:

- Page shell centers at `max-w-7xl`; prose and focused content columns at `max-w-4xl` (or `max-w-2xl` for centered CTA copy).
- Horizontal gutters are `px-6`, stepping to `px-8` at `lg`.
- Sections stack vertically with `py-24 sm:py-36` (compact sections use `py-20 sm:py-28`) and are separated by 1px `border` top or bottom rules rather than background changes.
- Cards use 28–32px padding (`p-7 sm:p-8`).
- Standard Tailwind breakpoints: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px. Every layout must work from 320px up.

## Texture & Depth

There is no shadow-based elevation. Surfaces are flat and separated by 1px borders. Depth comes from texture, applied via utilities:

- `noise` — an SVG fractal-noise overlay at 0.3 opacity with `mix-blend-mode: overlay`; applied to hero sections, banners, and colored cards.
- `grid-lines` — a faint 80px grid (`rgba(255,255,255,0.025)` lines) for page headers.
- Radial green washes, for example `bg-[radial-gradient(ellipse_60%_35%_at_50%_0%,rgba(47,93,80,0.2),transparent)]`, glow at the top of headers.
- An animated aurora background (`animate-aurora`, 60s linear loop) sits behind the home hero only.

The single shadow in the system is the primary CTA hover glow: `0 0 30px rgba(62, 207, 142, 0.15)`.

## Motion

Motion is quick, physical, and honest — it clarifies state, never decorates:

- Standard easing is `cubic-bezier(0.25, 1, 0.5, 1)`; hero and accordion reveals use `cubic-bezier(0.16, 1, 0.3, 1)`.
- State changes (color, border) run at 200ms; expand/collapse and menus at 250–300ms.
- Content fades in on scroll: opacity 0 → 1 with a 20px rise over 600ms, triggered once at 20% visibility.
- Interactive elements scale to 1.02 on hover and 0.97 on press. Cards lift 2px on hover (`card-hover`), only on fine pointers.
- Hero headlines slide up from behind an `overflow-hidden` mask (y: 110% → 0 over 900ms, staggered ~120ms per line).
- Always honor `prefers-reduced-motion`: drop translation and looping animation, keep opacity fades.

## Shapes

Corners are sharp. Buttons, cards, inputs, banners, and panels all render with no border radius. Do not introduce `rounded-*` on new surfaces; the only exceptions are small decorative elements like scrollbar thumbs. Borders are always 1px in `border`.

## Components

- **Primary button**: solid `text` (near-white) fill with dark `base` label, `px-7 py-3.5`, 14px semibold. Hover adds the green glow shadow (`0 0 30px rgba(62,207,142,0.15)`) and scales to 1.02. One per view.
- **Secondary button**: transparent fill with a 1px `border` outline; hover raises the border to `text/20` and tints the fill with `surface`.
- **Compact nav button** (for example Login): `green` fill, 1px `border`, `px-4 py-1.5`, 13px medium; hover shifts to `surface-raised`.
- **Inline link**: 14px medium in `green-bright` with the `link-underline` utility — a 1px underline that scales in from the left on hover; often paired with an `ArrowUpRight` icon at `size-3.5`.
- **Eyebrow + heading pattern**: a `label` in the intent color, `mb-4`, followed by a bold tracked-tight heading; used to open every section.
- **Accordion (FAQ)**: full-width rows split by `border` rules; question in `text-muted` warming to `text` on hover, a plus icon rotating 45° when open, 300ms height animation.
- **Card**: 1px `border` outline, flat or brand-color fill, `noise` texture when filled, `card-hover` lift.

Focus is visible on every interactive element: a 2px `gold` outline offset 3px, via `:focus-visible`. Text selection is `gold` with `base` text.

## Voice & Content

Copy is confident, concrete, and short. It sells outcomes, not features.

- Lead with the result: "Turn inbound into revenue", "From first message to closed deal."
- Use sentence case for headings and body; Title Case only for buttons and nav ("Book a Demo", "Learn more" stays sentence case when inline).
- Name actions with verb + noun; never "Submit", "OK", or a bare "Confirm".
- Keep body sentences under ~20 words. Use em dashes for emphasis, not parentheses.
- Use numerals ("95% ready to send") and skip filler: no "please", no "successfully", no marketing superlatives.
- Eyebrow labels are 2–4 words, uppercase by CSS, not in the source text ("What it does", "The problem").

## Do's and Don'ts

- Rank text with the opacity scale: `text` primary, `text-muted` secondary, `text-dim` tertiary.
- Reserve `gold` for one display or emphasis moment per view, plus selection and focus. Never use it for body text or fills.
- Use `green-bright` only for labels, links, and state — never as a background.
- Separate sections with 1px `border` rules, not background color changes or shadows.
- Apply the `label` / `label-sm` utilities for eyebrows instead of hand-setting tracking and casing.
- Keep WCAG AA contrast (4.5:1) for body text; `text-dim` is for decoration-grade text only.
- Don't round corners on buttons, cards, or inputs.
- Don't use Instrument Serif upright, in body copy, or in controls.
- Don't add shadows for elevation; the CTA glow is the only shadow.
- Don't animate anything the user didn't cause, except the hero aurora and scroll-linked reveals.
