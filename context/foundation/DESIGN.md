# Design System: emma.love
**Source URL:** https://emma.love
**Extracted:** 2026-06-17

---

## 1. Visual Theme & Atmosphere

The emma.love interface inhabits a **shadowed, intimate sanctuary** — the visual equivalent of a candlelit room where serious conversations about love unfold. The design philosophy is deliberately **cinematic and editorial**, pairing the dramatic weight of a dark-mode cinema lobby with the measured restraint of a private reading room. Nothing here is decorative for its own sake; every choice reinforces the message that this is a place for depth, not dopamine.

The mood is **warm yet cerebral, serene yet decisive**. The deep espresso backgrounds absorb light rather than reflect it, creating a cocooning effect that focuses attention on text and the warm copper accents that pull at the eye. A soft ambient glow blob in the hero — a blurred, warm sphere — suggests organic presence without resorting to photography. This is not a swipe app pretending to be mature; it is the design of something that genuinely refuses to shout.

**Key Characteristics:**
- Dark espresso canvas that makes the warm ivory text feel like candlelight, not fluorescence
- Two-temperature palette: espresso warmth for structure, copper glow for emphasis, parchment for call-to-action surfaces
- Dramatic typographic contrasts — black headline weight on dark ground, copper accent words slicing through
- Bento-grid feature cards mixing dark-on-dark and light-on-dark panels without visual fatigue
- An ambient decorative orb in the hero acting as soft visual warmth, not illustration
- Pill-shaped interactive elements maintaining consumer-app approachability within the editorial gravity

---

## 2. Color Palette & Roles

### Primary Foundation
- **Deep Espresso** (#2B1C17) — Primary page background. A dark, warm brown with red undertones — closer to a well-seasoned cast iron pan than a tech-startup "dark mode." Sets the intimate, unhurried tone of the entire experience.
- **Burnt Oak** (#3E2823) — Secondary surface for dark feature cards and subtle section separations. Lighter than the canvas by just enough to read as a raised panel when placed against the primary background.

### Text & Readable Surfaces
- **Warm Ivory** (#FFF9F0) — Primary text and light card backgrounds. Critically, this is not pure white — the slight cream warmth prevents the eye-straining contrast of #FFFFFF on near-black, making extended reading feel comfortable rather than tiring.
- **Parchment Cream** (#FFF9F0 at card scale) — Used as background fill for the light variant feature cards and the full-width CTA section. Creates the impression of warm paper laid on a dark table.

### Accent & Interactive
- **Copper Glow** (#E18256) — The primary accent. Used for keyword highlights within headlines ("Intelligently.", "true love,", "depth"), the opening quotation mark, section category labels, and the "NEW" badge. This warm copper-amber reads as warmth and intelligence rather than urgency — it invites rather than demands.
- **Soft Amber** (#F4A171) — Lighter variant of the copper, appearing in stat numbers, borders on interactive elements, and hover-adjacent states. Creates a gradient of warmth within the accent family.
- **Dusty Blush** (#C3A698) — A subdued, desaturated reddish-pink for secondary decorative elements and muted category labels. Recedes visually to support Copper Glow without competing with it.

### Functional States
- **Emerald Signal** (#2BB673) — "Active session" indicator in the hero chat mockup. The only cool-hued color on the page; its isolation makes it read immediately as a positive status.
- **Whisper Border** (#E6E6E6) — Thin 1px borders on light-surface cards and input fields. So soft it feels like a shadow rather than a drawn line.

---

## 3. Typography Rules

**Primary Font Family:** Geometric sans-serif (consistent with Inter-class typefaces — proportional, constructed letterforms, optically balanced at display sizes)

**Character:** A modern geometric sans-serif used at extreme weights and sizes for maximum typographic drama. At the largest sizes (H1), the letterforms take on a monumental, almost architectural quality. At body sizes, they retreat to quiet legibility without personality loss.

### Hierarchy & Weights

- **Display Hero (H1):** Black or extra-bold weight (800–900), 4–6rem, tight line-height (~1.0–1.1). Used exactly once per page. "True love." appears in Warm Ivory; the second line "Intelligently." appears in Copper Glow — a typographic two-tone technique that turns the H1 into a visual icon. Zero letter-spacing at this size preserves density and drama.

- **Section Headlines (H2):** Bold weight (700), 2.5–3.5rem, line-height 1.1–1.2. Continues the two-tone technique where a single key word appears in Copper Glow ("depth" in "Built on depth,"). Creates a reading beat — the eye finds the copper word first, then reconstructs the full sentence.

- **Feature Card Titles (H3):** Semi-bold to bold weight (600–700), 1.25–1.5rem, line-height 1.3. On dark cards use Warm Ivory; on light cards use Deep Espresso. The headline weight remains consistent regardless of surface.

- **Category Labels (above H3):** All-caps or small-caps, weight 500–600, 0.65–0.75rem, letter-spacing 0.08–0.12em. Copper Glow color. Functions as an editorial "section tag" that attributes the card to a product area ("SMART MATCHMAKING", "FOR COUPLES", "PRIVACY BY DESIGN").

- **Body / Descriptor Text:** Regular weight (400), 0.875–1rem, line-height 1.6–1.7. On dark surfaces: Warm Ivory at reduced opacity or Dusty Blush. On light surfaces: Deep Espresso. Comfortable paragraph rhythm without compression.

- **Navigation Links:** Regular to medium weight (400–500), 0.9rem, no letter-spacing. Warm Ivory on the dark nav bar. Quiet presence — the nav does not compete with the headline.

- **CTA Button Text:** Medium weight (500), 0.9–1rem, slight letter-spacing (0.01em), paired with arrow glyph "→" that signals directionality without verbosity.

### Spacing Principles
- Headlines and their supporting body text share very tight vertical coupling — the H1 and its sub-headline sit close, creating a conceptual unit before the section breathes
- Section-to-section spacing is generous (6–10rem) giving each thematic block room to hold its own weight
- Category labels sit 0.5rem above the H3 they introduce, establishing a visible but compact chain of attribution

---

## 4. Component Stylings

### Navigation Bar
- **Layout:** Full-width fixed-position bar, transparent background that reads against the dark page, logo lockup left-aligned, links center-grouped, CTA right-aligned
- **Link Default State:** Warm Ivory (#FFF9F0), regular weight, no underline — recedes into the background until needed
- **Link Hover State:** Subtle opacity reduction or slight lightening; smooth 200ms transition
- **Primary Nav CTA ("Join the waitlist"):** Bordered pill (border-radius ~9999px), 1px border in Warm Ivory, transparent fill, Warm Ivory text — a "ghost" button that reads as premium and restrained
- **Hover on Nav CTA:** Warm Ivory fill floods in, text color flips to Deep Espresso; smooth 200ms ease-in-out

### Primary CTA Buttons
- **Shape:** Pill-shaped (border-radius 9999px) — consumer-app approachability within the editorial container
- **"Start with Emma →":** Warm Ivory background (#FFF9F0), Deep Espresso text, arrow glyph appended — warmth-first invitation. Comfortable padding (~0.75rem vertical, 1.75rem horizontal)
- **Hover State:** Slightly creamy white deepens; subtle scale (1.02) or shadow lift; 200ms ease-out transition
- **"Join waitlist →" (CTA section):** Inverse — Deep Espresso (#2B1C17) background, Warm Ivory text, pill shape. The dark button on the parchment section reverses the page's dominant logic.
- **Focus State:** Visible outer ring in Copper Glow (#E18256) at 2px offset for keyboard accessibility

### Feature Cards — Dark Variant
- **Background:** Burnt Oak (#3E2823) — slightly lighter than page canvas so they read as raised surfaces
- **Corner Style:** Generously rounded (20–24px) — friendly, modern, app-like; prevents the dark rectangles from reading as tombstones
- **Border:** Hairline (1px) in a slightly lighter brown or transparent — structural rather than decorative
- **Shadow:** Flat to near-flat; depth is achieved by the background contrast, not drop shadows
- **Category label → H3 → Body:** Standard typographic stack with Copper Glow category label
- **Large stat number variant:** The display stat ("50+") appears in Copper Glow at ~4rem, with a thin horizontal rule in Soft Amber below it

### Feature Cards — Light Variant
- **Background:** Warm Ivory (#FFF9F0) — parchment panels set against the dark canvas, creating strong figure-ground reversal
- **Corner Style:** Matching 20–24px rounding for visual family consistency
- **Text:** Deep Espresso for headings and body; category labels in Copper Glow
- **Shadow:** Whisper-soft diffused shadow on light cards against the dark ground — the contrast alone creates sufficient elevation

### CTA Full-Width Section
- **Background:** Warm Ivory (#FFF9F0) with a subtle warm gradient or texture suggestion (parchment quality)
- **Corner Style:** 20–24px rounding on all sides — the section is a contained "card" not a full-bleed strip
- **Layout:** Left-side headline + body, right-side form fields stacked vertically
- **Input Fields:** Light background (#FFFFFF), 1px Whisper Border (#E6E6E6), pill or subtly rounded corners (8–12px), placeholder text in muted mid-gray
- **Form Input Focus:** Border color shifts to Copper Glow, subtle outer glow; smooth 200ms transition

### Stat/Metric Row
- **Layout:** 4-column horizontal with thin vertical separators in Soft Amber
- **Number:** Display weight, ~3–4rem, Copper Glow (#E18256)
- **Label:** Regular weight, 0.8rem, Warm Ivory at reduced opacity

### "NEW" Badge
- **Shape:** Pill/capsule (border-radius 9999px)
- **Background:** Soft Amber (#F4A171) or Copper Glow
- **Text:** Deep Espresso, extra-bold, 0.65rem, uppercase
- **Usage:** Single instance in the hero only — scarcity preserves its signal value

### Hero Ambient Orb
- **Treatment:** A blurred, radially-graduated sphere — warm beige to cream tones, no sharp edges, rendered purely in CSS or SVG
- **Role:** Introduces warmth and biological softness into an otherwise typographic composition; suggests the "presence" of Emma without depicting a person
- **Size:** ~30–40% of the hero card height; centered within the conversation mock card

---

## 5. Layout Principles

### Grid & Structure
- **Max Content Width:** ~1280px — wide enough for editorial spread, narrow enough to avoid the card-UI feeling adrift on large monitors
- **Primary Layout Pattern:** Two-column hero (40% text + 60% floating card mockup), single-column stats strip, bento-grid feature section (asymmetric 1-2-2 or similar), full-width quote, full-width CTA card
- **Bento Grid:** Feature cards use a masonry-adjacent layout where one large card occupies the same vertical space as two stacked smaller cards — creates visual rhythm without rigid uniformity

### Whitespace Strategy
- **Base Unit:** 8px; major section gaps at 10–16 base units (80–128px)
- **Within-section spacing:** 2–4rem between headline and its body text; 3–5rem between the heading group and the feature cards
- **The dark canvas does the work of breathing room** — because the background itself is recessive, elements do not need aggressive whitespace to feel uncluttered

### Alignment
- Body text and headlines: left-aligned throughout (including the quote section)
- Hero layout: left column for text, right column for the floating UI demo — creates clear reading flow from promise to proof
- Navigation: left logo anchor, right CTA anchor, middle navigation links

---

## 6. Depth & Elevation

The site uses **inverted depth logic**: the dark page background functions as the deepest level, and surfaces elevate toward light rather than casting downward shadows.

- **Ground (deepest):** Deep Espresso (#2B1C17) page canvas — the visual floor
- **Panel level:** Burnt Oak (#3E2823) dark cards — raised ~1 level, achieved by lightness differential alone
- **Surface level:** Warm Ivory (#FFF9F0) light cards and CTA sections — maximum elevation expressed through warm light, not drop shadows
- **Interactive overlays:** Hero chat mockup card uses a pure white (#FFFFFF) surface on the warm background with a soft contained shadow (approximately `0 8px 32px rgba(0,0,0,0.12)`) — the one place where a conventional drop shadow appears
- **Ambient decorative depth:** The hero orb introduces organic, non-geometric softness that prevents the dark surfaces from feeling hard or oppressive

---

## 7. Motion & Animation

- **Micro-interactions:** Smooth 200ms ease-in-out for button color flips, nav hover states, border highlight transitions
- **CTA button:** Subtle scale pulse (1.0 → 1.02) or shadow emergence on hover — suggests responsiveness without movement theater
- **Page scroll:** Sections likely use subtle entrance animations (fade-in + translateY upward) at ~300ms with ease-out — consistent with the deliberate, unhurried personality of the brand
- **The "Emma is listening" indicator in the hero:** Animated waveform bars — the only looping animation on the page, intentionally drawing the eye to simulate a live session
- **Easing philosophy:** ease-out for arrivals (elements landing into view), ease-in-out for state toggles — no bounce, no spring, no elastic curves. The brand is warm but never bouncy.

---

## 8. Do's and Don'ts

### Do
- Use **Copper Glow (#E18256)** sparingly — one or two words per headline maximum; overuse destroys its signal value
- Maintain the **inverted depth logic**: let surface lightness indicate elevation rather than drop shadows on dark elements
- Write **category labels in all-caps with generous letter-spacing** above every H3 — this is a core structural pattern
- Use the **pill shape (border-radius: 9999px)** for all interactive buttons and tags — it is non-negotiable for brand consistency
- Preserve the **two-temperature text rule**: Warm Ivory on dark surfaces, Deep Espresso on light surfaces
- Keep the **hero orb** purely as an ambient warmth element — never replace it with a photograph of a person

### Don't
- Do not use pure black (#000000) or pure white (#FFFFFF) for large text blocks — always use Deep Espresso and Warm Ivory respectively
- Do not introduce blues, teals, or cool grays — the entire palette is warm; a single cool element would read as an error
- Do not add gradients to the background — the flat dark canvas is intentional and structural
- Do not crowd the feature card bento — cards need breathing room between them; tight packing destroys the premium feel
- Do not use the Emerald Signal (#2BB673) for anything other than positive status indicators — it is powerful precisely because it appears exactly once on the page
- Do not use bounce, elastic, or spring easing — the brand temperament is warm gravity, not playful rebound

---

## 10. Responsive Behavior

- **Navigation:** Full horizontal link bar collapses to hamburger or bottom navigation on mobile; "Join the waitlist" CTA persists
- **Hero:** Two-column (text + mockup card) stacks to single column on mobile; mockup card drops below the headline and CTA
- **Bento grid:** Asymmetric multi-column layout collapses to a single-column card stack; large card loses its extra height span
- **Stats row:** 4-column horizontal wraps to 2×2 grid on tablet, single column on small mobile
- **CTA section:** Two-column (headline + form) stacks to headline-over-form on mobile
- **Typography:** Hero H1 scales down from ~5rem to ~2.5rem; the two-tone headline technique is preserved at all breakpoints
- **Touch targets:** All pill buttons maintain minimum 44px height for comfortable thumb interaction

---

## 11. Agent Prompt Guide

### Color Quick Reference

| Name | Hex | Role |
|------|-----|------|
| Deep Espresso | #2B1C17 | Primary page background |
| Burnt Oak | #3E2823 | Dark card surfaces |
| Warm Ivory | #FFF9F0 | Primary text + light card backgrounds |
| Copper Glow | #E18256 | Keyword accent, category labels, key CTAs |
| Soft Amber | #F4A171 | Stat numbers, secondary highlights |
| Dusty Blush | #C3A698 | Subdued secondary accent |
| Emerald Signal | #2BB673 | Status green (use once only) |
| Whisper Border | #E6E6E6 | 1px borders on light surfaces |

### Component Prompts

- "Create a hero section with Deep Espresso (#2B1C17) background, bold sans-serif H1 at 5rem: first line 'True love.' in Warm Ivory (#FFF9F0), second line 'Intelligently.' in Copper Glow (#E18256), left-aligned, with a pill-shaped 'Start with Emma →' button in Warm Ivory fill and Deep Espresso text"

- "Design a feature card with Burnt Oak (#3E2823) background, 24px border-radius, Copper Glow (#E18256) all-caps category label at 0.65rem with 0.1em letter-spacing above a bold Warm Ivory heading at 1.25rem"

- "Build a navigation bar with transparent background, Warm Ivory links, and a ghost pill button 'Join the waitlist' with 1px Warm Ivory border — no background fill, pill shape (border-radius: 9999px)"

- "Create a full-width CTA section as a contained card with 24px border-radius and Warm Ivory (#FFF9F0) background, dark Deep Espresso text, a 'Ready for true love,' headline where 'true love,' is in Copper Glow, stacked email + name inputs on the right, and a Dark Espresso pill 'Join waitlist →' button"

- "Add a stat row with 4 columns separated by thin Soft Amber vertical rules — each cell shows a large Copper Glow display number (~3.5rem) with a short Warm Ivory muted-opacity label beneath"

- "Render an ambient hero orb: a blurred, radially graduated circle ~300px diameter, warm beige (#E8C9B0) center fading to transparent edges, placed inside the hero conversation-mockup card as a decorative background element"

### Incremental Iteration Tips
1. The copper accent is the brand signature — in any iteration, it must appear in headlines and nowhere else at large scale
2. When building cards, always lead with the all-caps Copper Glow category label before the heading — it establishes the editorial pattern
3. Test dark-card vs. light-card balance; the intended ratio is roughly 60% dark cards to 40% light cards in the feature bento
4. Never flatten the pill-to-pill button language; if you add a new CTA it must be pill-shaped
5. The page is intentionally text-heavy with no product photography — respect this; do not introduce faces, stock photos, or illustration beyond the ambient orb