# Design System: Mój Ogród

**Product:** Garden management web app (Polish-first, mobile-first)  
**Theme:** Earthy outdoor light — parchment surfaces, forest green actions, terracotta accents  
**Last updated:** 2026-06-17

---

## 1. Product Identity & Tone

Mój Ogród is a practical tool for gardeners and small farmers. The interface should feel **calm, grounded, and outdoorsy** — like planning on a wooden table in natural light, not a cosmic developer starter or a dark dating app.

**Tone:**

- Clear, helpful, never playful or gimmicky
- Polish copy throughout; no English UI strings in v1
- Confidence through readability and touch-friendly controls, not flashy gradients

**Do:**

- Use semantic tokens (`bg-background`, `bg-card`, `text-primary`, `border-border`)
- Prefer cards on parchment with white elevated surfaces
- Keep mobile bottom navigation thumb-reachable (min 44px touch targets)

**Don't:**

- No purple/cosmic gradients, starfields, or glass-dark overlays (`bg-cosmic` is deprecated — removed in Phase 5)
- No "10x Astro Starter" or generic starter branding
- No dark-mode-first layouts; `.dark` tokens exist for shadcn compatibility only

---

## 2. Color Tokens

All colors map to CSS variables in `src/styles/global.css` (`:root`). Use Tailwind utilities (`bg-background`, `text-foreground`, etc.) — never hardcode hex in components.

| Role | Name | Hex | CSS variable |
|------|------|-----|--------------|
| Page background | Parchment | `#F5F1E8` | `--background` |
| Card surface | White | `#FFFFFF` | `--card` |
| Primary text | Soil | `#3D3229` | `--foreground`, `--card-foreground` |
| Primary action | Forest | `#2D6A4F` | `--primary` |
| On primary | Cream | `#F5F1E8` | `--primary-foreground` |
| Accent / highlights | Terracotta | `#C67B4E` | `--accent` |
| On accent | Soil | `#3D3229` | `--accent-foreground` |
| Secondary surface | Light parchment | `#EDE8DF` | `--secondary` |
| Muted text | Stone | `#6B5E54` | `--muted-foreground` |
| Muted surface | Soft parchment | `#EDE8DF` | `--muted` |
| Border | Sand | `#E2D9CC` | `--border`, `--input` |
| Focus ring | Forest (soft) | `#2D6A4F` @ 50% | `--ring` |
| Destructive | Rust red | `#B44334` | `--destructive` |

**Semantic usage:**

- **Background** — page canvas (`body`, public landing, auth backdrop)
- **Card** — panels, forms, weather widget, field lists
- **Primary** — main CTAs (Zaloguj się, Utwórz pole, Zapisz)
- **Accent** — secondary emphasis (links, badges, harvest highlights) — use sparingly
- **Muted** — helper text, empty states, metadata

---

## 3. Typography

**Font stack (v1):** System UI — no web font required initially.

```css
font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

**Optional later:** [Source Serif 4](https://fonts.google.com/specimen/Source+Serif+4) for marketing headlines only.

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Display | `text-4xl`–`text-5xl` | 700 | Landing hero |
| H1 (page) | `text-2xl`–`text-3xl` | 700 | App shell page title |
| H2 (section) | `text-lg`–`text-xl` | 600 | Section headings (Moje pola, Pogoda) |
| Body | `text-sm`–`text-base` | 400 | Paragraphs, list items |
| Label | `text-sm` | 500 | Form labels |
| Caption | `text-xs` | 400 | Hints, timestamps |

**Rules:**

- Headlines use `text-foreground`; avoid gradient text
- Muted supporting copy uses `text-muted-foreground`
- Line height: `leading-relaxed` for body, `leading-tight` for headings

---

## 4. Spacing & Radius

**Spacing scale:** Tailwind default (4px base). Section gaps: `gap-6` / `py-8`. Card padding: `p-4` mobile, `p-6` desktop.

**Radius:**

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` | `0.625rem` (10px) | Default (buttons, inputs) |
| `rounded-lg` | `--radius` | Cards, dialogs |
| `rounded-xl` | `calc(var(--radius) + 4px)` | Feature cards, field tiles |
| `rounded-full` | pill | Badges only |

---

## 5. Components

### Buttons

- **Primary:** `bg-primary text-primary-foreground hover:bg-primary/90`
- **Secondary / outline:** `border-border bg-card hover:bg-muted`
- **Ghost:** `hover:bg-muted` for nav links
- **Destructive:** `bg-destructive text-white` for delete/reject
- Min height **44px** on mobile (`min-h-11` or `py-2.5 px-4`)

### Cards

- `bg-card border border-border rounded-xl shadow-sm`
- No backdrop-blur or `bg-white/5` glass effects
- Header: `text-lg font-semibold`; body: `text-muted-foreground` for subtitles

### Inputs & forms

- `bg-card border-input` with `focus-visible:ring-ring`
- Error state: `border-destructive text-destructive` + message below field
- Auth and create-field forms sit inside a centered card on `bg-background`

### Dialogs

- shadcn `Dialog` with `bg-card`, `border-border`
- Footer: primary action right, cancel left (Polish: Anuluj / Zapisz)

### Navigation (AppShell)

- **Mobile:** fixed bottom bar, 3–4 items, icon + label, `activeNav` uses `text-primary font-medium`
- **Desktop (`md+`):** horizontal links in header
- Items: Panel, Katalog, Ustawienia; Admin link when `role === "admin"`

### Banners & alerts

- Success/info: `bg-muted border-border`
- Error: `border-destructive/30 bg-destructive/10 text-destructive`

---

## 6. Field Grid

The planting grid is the core interactive surface.

| Rule | Value |
|------|-------|
| Cell min size | **44px** touch target (`min-h-11 min-w-11`) |
| Empty cell | `bg-muted/50 border-border` dashed or solid light border |
| Planted cell | `bg-primary/10 border-primary/30` + plant initial or icon |
| Selected / focus | `ring-2 ring-ring` |
| Grid gap | `gap-1` or `gap-1.5` — dense but tappable |

Labels for row/column indices: `text-xs text-muted-foreground`.

---

## 7. Weather Panel

Hierarchy (top → bottom):

1. **City name** — `text-lg font-semibold`
2. **Current temp** — large (`text-3xl font-bold`)
3. **Condition label** — `text-muted-foreground` (Polish from `pl.weather`)
4. **Rainfall / forecast row** — compact badges, `text-sm`
5. **City search** — input at bottom or top; suggestions dropdown `bg-popover border-border`

Card: same as other cards. Stale data: muted badge "Dane mogą być nieaktualne".

---

## 8. Polish-First Copy

- All user-visible strings live in `src/lib/copy/pl.ts`
- Import `pl` constants in Astro frontmatter or React components
- Plant **names** in the catalog stay as stored in DB (e.g. Tomato); **labels** around them are Polish (Dni wzrostu, Potrzeby wodne)
- Date formatting: Polish locale (`pl-PL`) where formatted in UI
- Error messages: short, actionable Polish sentences

---

## 9. Layout Patterns

| Screen | Pattern |
|--------|---------|
| Public landing | Centered hero + 3 feature cards, max-width `max-w-4xl` |
| Auth | Centered card `max-w-md` on `bg-background` |
| Dashboard | AppShell + `lg:grid-cols-[1fr_auto]` (fields left, weather right) |
| Field detail | AppShell + grid + weather sidebar |
| Catalog / settings | AppShell + single-column content `max-w-3xl` |

**Content max width:** `max-w-6xl` for shell main area.

---

## 10. Responsive Behavior

- **Mobile-first:** bottom nav visible `< md`; top nav links `md+`
- **Landing:** single column; feature cards stack
- **Dashboard grid:** weather below fields on mobile, sidebar on `lg+`
- **Touch:** all interactive elements ≥ 44px hit area
- **Typography:** scale down display sizes one step on `sm` breakpoints

---

## 11. Deprecated (remove in Phase 5)

- `@utility bg-cosmic` — cosmic purple gradient background
- Inline `from-blue-200 to-purple` gradient text
- `border-white/10`, `bg-white/5`, `text-blue-100/*` cosmic glass patterns

---

## Agent Quick Reference

```
Page: bg-background text-foreground
Card: bg-card border border-border rounded-xl shadow-sm
CTA: bg-primary text-primary-foreground
Muted: text-muted-foreground
Field cell: min-h-11 min-w-11 border-border
Copy: import { pl } from "@/lib/copy/pl"
```
