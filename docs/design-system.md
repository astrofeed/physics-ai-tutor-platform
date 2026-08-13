# Design system

The visual language is "physics coursebook": warm paper, ink-navy accents, hairline
rules, tabular figures. Everything below is encoded in `tailwind.config.ts` and
`src/app/globals.css` — use the tokens, never one-off arbitrary values.

## Color

Semantic roles live as HSL triples in `globals.css` (`--background`, `--card`,
`--primary`, `--border`, `--chart-1..5`, light and dark). Neutrals are mapped to
Tailwind `stone`, so `gray-*`/`neutral-*` are warm, not blue-grey.

`brand-50..950` is a hand-built navy scale used for primary actions, links and the
first chart series. Contrast targets: body text ≥ 4.5:1, large text and UI borders
≥ 3:1. Never encode meaning in hue alone — pair color with a label or icon.

| Role | Token |
| --- | --- |
| Page background | `bg-background` (warm off-white / near-black) |
| Surface | `bg-card` |
| Hairline | `border-border` |
| Primary action | `bg-primary text-primary-foreground` |
| Quiet text | `text-muted-foreground` |
| Charts | `hsl(var(--chart-1))`..`--chart-5` via `CHART_SERIES_COLORS` |

## Typography

One family (Geist) plus Geist Mono for data and code. Hierarchy comes from a
modular scale (ratio ≈1.25, 15px body), not from a second display face. Each step
ships its own line-height and tracking, so use the named step instead of pairing
`text-2xl` with ad-hoc `tracking-*`.

| Step | Size | Use |
| --- | --- | --- |
| `text-display` | 36px | Dashboard greeting only |
| `text-title` | 28px | Page titles (`.page-title`), stat figures |
| `text-heading` | 23px | `h2` |
| `text-subheading` | 19px | `h3`, `.section-title` |
| `text-body-lg` | 17px | Lede paragraphs in reading views |
| `text-body` | 15px | Default body copy |
| `text-caption` | 12px | Hints, metadata |
| `text-label` | 11px, +0.14em, uppercase | `.eyebrow` labels |

Rules: `h1`/`h2`/`h3` get their size from the base layer, so pages should not
restate sizes; keep at most four steps on a screen; use `tabular-nums` for any
figure that changes; keep prose within `.measure` (65ch).

## Spacing and rhythm

8px base. Inside components use `2` (8px) / `3` (12px) / `4` (16px); between
elements in a group `4`; `gap-gutter` (24px) between cards and grid cells;
`space-y-section` (40px, via `.page-sections`) between page sections. Page padding
is owned by the layout shell, not by pages.

## Layout

`MainLayoutClient` wraps every route in `.page-shell` (centred, `max-w-shell`
= 1248px) with `px-gutter py-8` on ≥sm. Routes in `FULL_BLEED_ROUTES` (`/chat`,
`/simulations`) opt out and manage their own width.

Page composition:

```tsx
<div className="page-sections">
  <div className="page-header">
    <p className="eyebrow">Your record</p>
    <h1 className="page-title">Learning analytics</h1>
    <p className="page-lede">One sentence on what is measured.</p>
  </div>
  <StatBand items={...} />
  <div className="grid grid-cols-1 gap-gutter lg:grid-cols-2">...</div>
</div>
```

Breakpoints follow Tailwind defaults; `.grid-12` gives the 4/8/12-column page grid
when a layout needs asymmetric columns. Cards are hairline-bordered
(`.card-minimal`); elevation is limited to `shadow-hairline`, `shadow-raised`
(hover/menus) and `shadow-overlay` (dialogs). No gradients, no glows, no
gradient text.

## Shell and signal color

The app has two surfaces. The navigation rail is an ink surface built from the
`--sidebar*` tokens (`bg-sidebar`, `text-sidebar-foreground`, `text-sidebar-muted`,
`bg-sidebar-active`, `border-sidebar-border`); the content area is the flat warm
paper `bg-background`, with cards a shade lighter (`bg-card`) on top of it. Keep the
canvas plain — no textures, grids or tints behind content. Full-bleed routes
(`/chat`, `/simulations`) sit on the same canvas without the page shell.

One accent only: `--signal`, a copper reserved for orientation — the wordmark
atom, the 2px bar on the active nav item, badges, page eyebrows
(`.eyebrow-signal`), and the numbered `.section-index` in `.section-rule`. It
never fills a large area and never appears twice for the same purpose on a
screen. Headline figures in `StatBand` use `text-display`, so the number, not a
color, carries the emphasis.

## Cards

List cards (recent conversations, upcoming assignments, open appeals) share one
shape: `.card-minimal`, a header row with `.section-title` plus an optional text
link separated by a hairline rule, then rows divided by `divide-border` with the
subject on the left and a `tabular-nums` timestamp on the right. Empty states are
two lines of text and, where useful, one text link — no illustrative icon
clusters. Charts take their colors from `CHART_SERIES_COLORS` or
`CATEGORY_COLORS`, both of which resolve to theme tokens in either mode.

## Patterns to avoid

Pastel gradient stat cards, uniform icon-in-circle grids, full-width stretched
dashboards, emoji as iconography, three competing accent hues on one screen, and
copy that describes a metric more confidently than it is measured (see the
analytics rules in `AGENTS.md`).

## Design skills

Reference procedures live in agent skills — install with
`npx skills add owl-listener/designer-skills -g -y`. Most relevant here:
`layout-grid`, `spacing-system`, `typography-scale`, `color-system`,
`design-token`, `visual-hierarchy`, `readable-measure`, `data-visualization`,
plus the critique passes `critique-composition`, `critique-typography`,
`critique-color` and `design-token-audit` before shipping UI work.
