# UI Cosmetic Overhaul — Proposal

## Design Direction

**"Galactic brutalism"** — the restraint and geometric clarity of a galactic senate chamber crossed with the raw honesty of industrial architecture. Every element earns its place. Dark, authoritative, engineered.

### Guiding Principles

1. **Dark-first.** Deep, near-black backgrounds. Light text. The screen is the void; content floats in it.
2. **Pure monochrome.** Signal white (`#ffffff`) as the sole accent — brightness itself is the highlight. Active states, focus rings, emphasis. Everything else is greyscale. Maximum restraint.
3. **Monospace DNA.** Primary UI text in a geometric sans-serif (Inter or similar), but monospace (JetBrains Mono) for anything data-related: tool calls, SQL, log output, code, timestamps. The blend of the two type families creates the "engineered but human" tension.
4. **Hard geometry.** Sharp corners by default (no border-radius) — selective rounding only where it signals interactivity (buttons, inputs get `2px`). Brutalist buildings don't have rounded corners.
5. **Visible grid.** Thin `1px` borders in a muted grey (`rgba(255,255,255,0.08)`) to expose the underlying structure. Borders as load-bearing elements, not decoration.
6. **Generous negative space.** Let things breathe. Padding and margin do more visual work than colour or ornament.
7. **No shadows, no gradients.** Depth comes from layered background tones (e.g. `#0a0a0f` → `#12121a` → `#1a1a24`), not from drop-shadows or blurs.
8. **Purposeful motion.** Transitions only where they communicate state change (hover, focus, route change). 150ms ease-out, nothing slower. No decorative animation.

---

## Palette

| Token              | Value                    | Usage                                        |
| ------------------- | ------------------------ | -------------------------------------------- |
| `--bg-base`         | `#0a0a0f`                | Page background, the void                    |
| `--bg-surface`      | `#12121a`                | Cards, panels, chat message area             |
| `--bg-elevated`     | `#1a1a24`                | Inputs, interactive surface resting state    |
| `--bg-hover`        | `#22222e`                | Hover state for interactive elements         |
| `--border`          | `rgba(255,255,255,0.08)` | Structural lines                             |
| `--border-active`   | `rgba(255,255,255,0.15)` | Borders on focused/active elements           |
| `--text-primary`    | `#e8e8ec`                | Body text                                    |
| `--text-secondary`  | `#8a8a96`                | Labels, hints, timestamps                    |
| `--text-muted`      | `#4a4a56`                | Disabled text, placeholders                  |
| `--accent`          | `#ffffff`                | Focus rings, active nav, primary actions     |
| `--accent-dim`      | `rgba(255,255,255,0.06)` | Accent background tint (active nav pill etc) |
| `--error`           | `#ff4d6a`                | Error states                                 |
| `--success`         | `#34d399`                | Success indicators                           |

---

## Typography

| Role          | Font            | Weight | Size     | Tracking    |
| ------------- | --------------- | ------ | -------- | ----------- |
| Nav labels    | Inter           | 500    | `13px`   | `0.04em`    |
| Section heads | Inter           | 600    | `14px`   | `0.06em`    |
| Body text     | Inter           | 400    | `14px`   | `0`         |
| Form labels   | Inter           | 500    | `12px`   | `0.04em`    |
| Code / data   | JetBrains Mono  | 400    | `13px`   | `0`         |
| Chat input    | Inter           | 400    | `14px`   | `0`         |

All caps on nav labels and section headings — military/institutional feel without shouting. Tight but readable sizes throughout.

Fonts loaded via Google Fonts in `index.html` (two `<link>` tags, no JS).

---

## Component-by-Component Changes

### 1. Global (`App.vue` + new `global.css`)

**Current state:** Zero styling. Nav is unstyled `<router-link>` text.

**Proposed:**

- Create a `global.css` with CSS custom properties (the palette above), a minimal reset (box-sizing, margin/padding zero, font smoothing), and base `body` styles.
- Import `global.css` in `main.js`.
- `App.vue` layout: flex column — horizontal top bar + fluid main content area below.

**Nav redesign:**
- Horizontal top bar with `--bg-surface` background and `1px --border` bottom edge.
- "PARSEC" wordmark on the left: `--text-muted`, `10px` uppercase, wide tracking (`0.12em`).
- Nav links inline to the right of the wordmark: uppercase `13px` Inter 500 with `0.04em` tracking.
- Resting state: `--text-secondary` colour, no background.
- Hover: text shifts to `--text-primary`, background to `--bg-hover`, 150ms transition.
- Active route (`.router-link-active`): `--accent` text, bottom `2px` solid accent border, background tinted with `--accent-dim`.

### 2. ConnectorsView

**Current state:** Bare `<h1>`, unstyled `<section>` blocks, default browser form elements.

**Proposed:**

- Replace `<h1>` with a small uppercase section label ("CONNECTORS") styled as a page header.
- Three connector sections become distinct panels: `--bg-surface` background, `1px --border` border, no radius, internal padding `24px`.
- Each panel has a small uppercase label at the top ("DATABASE", "CODEBASE", "SERVER LOGS") in `--text-secondary`.
- Form labels: `12px` uppercase Inter 500 in `--text-secondary`, positioned above inputs with `6px` gap.
- Inputs and selects: `--bg-elevated` background, `1px --border` border, `2px` border-radius, `--text-primary` text, `14px`. On focus: border shifts to `--accent`, subtle `0 0 0 1px var(--accent)` outline (the only "glow" in the entire app — a focus ring, not decoration).
- Panels separated by `24px` vertical gap.

### 3. AgentConfigView

**Current state:** Bare `<h1>`, default form elements, no structure.

**Proposed:**

- Same panel treatment as ConnectorsView — single panel since it's one logical group.
- API key input: monospace font, wider letter-spacing on the masked characters for visual rhythm.
- Model select: custom-styled dropdown matching the input aesthetic. Consider showing model names as `SONNET 4.5` / `OPUS 4` in small caps.
- System prompt textarea: taller default (6 rows), monospace font (JetBrains Mono) since it's prompt code. Subtle line-height increase (`1.6`) for readability.
- Small helper text beneath the API key field ("Key is sent per-request and never stored") in `--text-muted`, `12px`.

### 4. AgentView (Chat)

**Current state:** Basic flex layout, pastel message backgrounds (#f0f0f0, #e8f4fd), default form styling, plain text loading state.

**Proposed:**

- **Messages area:** `--bg-surface` background, no border (the surface colour shift is enough). Full remaining height via flex.
- **User messages:** Right-aligned, `--bg-elevated` background, slight left margin (20% of width) to push them right. No border-radius except `2px` on the top-left corner — the single softened corner is a subtle brutalist detail.
- **Assistant messages:** Left-aligned, no background (inherits `--bg-surface`), left border `2px solid var(--border-active)` instead. Text is the focus, not a coloured bubble.
- **Error messages:** Left-aligned like assistant, but left border colour is `--error`.
- **Tool call blocks:** Collapsible (existing behaviour), but styled as nested panels: `--bg-base` background (darker than the chat surface — a recessed look), monospace font, `1px --border` border. The tool name displayed as an uppercase `11px` label. Expand/collapse toggle is a small `+`/`-` glyph, not a word.
- **Chat input area:** Full-width bar pinned to bottom. Input field: `--bg-elevated`, no visible border in resting state, border appears on focus (`--accent`). Send button: `--accent` background, `#0a0a0f` text, uppercase `12px` tracked label ("SEND"), `2px` border-radius. Disabled state: `--bg-hover` background, `--text-muted` text.
- **Loading state:** Replace "Thinking..." text with a minimal three-dot pulse animation in `--text-primary` (CSS-only, three small circles that fade in sequence). Positioned where the next assistant message will appear.
- **Timestamps:** Optional — small `--text-muted` timestamp on each message, monospace `11px`. Can defer this.

---

## Implementation Approach

All changes are pure CSS + minor template adjustments. No new dependencies beyond the two Google Fonts links.

### Files touched:
| File | Change |
|------|--------|
| `frontend/index.html` | Add Google Fonts `<link>` tags (Inter + JetBrains Mono) |
| `frontend/src/main.js` | Import new `global.css` |
| `frontend/src/assets/global.css` | **New file.** CSS reset, custom properties, base styles |
| `frontend/src/App.vue` | Horizontal top bar nav, nav link styling, wordmark |
| `frontend/src/views/ConnectorsView.vue` | Panel structure, form element styling |
| `frontend/src/views/AgentConfigView.vue` | Panel structure, form element styling |
| `frontend/src/views/AgentView.vue` | Message styling overhaul, input bar, loading state |

### What this does NOT include (intentionally):
- No component library or CSS framework added
- No JavaScript behaviour changes
- No new routes or views
- No dark/light mode toggle (dark is the mode)
- No icons or icon library (can add later if needed)

---

## Decisions (locked in)

- **Accent colour:** Signal white (`#ffffff`) — pure monochrome, brightness as emphasis
- **Navigation:** Horizontal top bar
- **Font loading:** Google Fonts (`<link>` tags in `index.html`)
- **Wordmark:** "PARSEC" as uppercase tracked text, no logo asset
