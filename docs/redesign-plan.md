# GuildBoard Redesign

Apple-native reset. Dark only, done properly. Compact on mobile, spacious on
desktop.

Driven by four stated problems: pages look inconsistent, everything feels flat,
hierarchy is unclear, mobile is weak. Every decision below traces back to one of
those.

---

## The one-line brief

> Neutral grayscale surfaces carrying a real elevation model, one accent
> (saffron) spent sparingly on what you can act on, system typography, and
> spacing that breathes on desktop without wasting a phone screen.

---

## 1. Foundations

### 1.1 Color: neutral surfaces, semantic accents

The current palette has six accent colors doing unclear jobs (saffron, matcha,
indigo, wisteria, vermillion, plus cha as a text gray). Wisteria and indigo are
used decoratively, which is exactly why nothing reads as important.

**New rule: color means something or it does not appear.**

| Token | Value | Job |
|---|---|---|
| `--bg` | `#000000` | App background. True black, and OLED phones thank you. |
| `--surface-1` | `#131315` | Cards, rows. The default raised plane. |
| `--surface-2` | `#1C1C1F` | Modals, sheets, popovers. |
| `--surface-3` | `#26262A` | Menus and anything above a sheet. |
| `--fill` | `rgba(120,120,128,0.20)` | Inert chips, track backgrounds. |
| `--fill-strong` | `rgba(120,120,128,0.32)` | Pressed and hover states. |
| `--separator` | `rgba(255,255,255,0.10)` | Hairlines between rows. |
| `--border` | `rgba(255,255,255,0.14)` | Card and control outlines. |

Content, as opacity ramps rather than separate hexes, so text sits correctly on
any surface:

| Token | Value | Job |
|---|---|---|
| `--label` | `rgba(255,255,255,0.96)` | Primary text. |
| `--label-2` | `rgba(255,255,255,0.62)` | Supporting text. |
| `--label-3` | `rgba(255,255,255,0.38)` | Metadata, timestamps. |
| `--label-4` | `rgba(255,255,255,0.22)` | Disabled, placeholders. |

Accents, and the only accents:

| Token | Value | Job |
|---|---|---|
| `--accent` | `#E8913A` saffron | The one thing you can act on. Retained from the current identity. |
| `--success` | `#3DB88A` matcha | Confirmed, shipped, done. |
| `--danger` | `#DC4A3A` vermillion | Destructive or failed. Never decorative. |

**Retired:** wisteria and indigo-jp as decoration. Category colors become a
single neutral chip plus a text label, because eight categories in eight colors
is noise, not information.

> **Decision to confirm:** this is the piece that most reduces visual
> personality. Saffron survives as the sole accent, so the app still reads as
> GuildBoard, but the purple and blue chips go.

### 1.2 Elevation: how "dark, done well" gets depth

Depth comes from **surface lightness first, shadow second**. This is the whole
answer to "feels flat".

| Level | Surface | Shadow | Used by |
|---|---|---|---|
| 0 | `--bg` | none | Page background |
| 1 | `--surface-1` | none, `--border` hairline | Cards, list rows |
| 2 | `--surface-2` | `0 8px 24px rgba(0,0,0,.4)` | Sheets, modals |
| 3 | `--surface-3` | `0 16px 40px rgba(0,0,0,.5)` | Menus, popovers |
| Chrome | `blur(24px)` over `--bg/72` | none | Nav bars, tab bar |

Rules: never stack two translucent layers, bigger surfaces get stronger blur and
deeper shadow, and a scrim only appears for genuinely blocking tasks.

### 1.3 Typography: system stack, Apple scale

**Retire Playfair Display for UI.** The system font already ships optical
sizing, tracking tables and legibility tuning, and it is the Apple-native
answer.

> **Decision to confirm:** keep Playfair for the `◈ GuildBoard` wordmark only,
> as a single brand moment. Everything else becomes system.

Tracking is size-specific, leading runs inverse to size:

| Class | Size / Leading | Tracking | Weight | Use |
|---|---|---|---|---|
| `text-title-1` | 28 / 34 | `-0.02em` | 700 | Page titles |
| `text-title-2` | 22 / 28 | `-0.018em` | 700 | Section titles |
| `text-title-3` | 17 / 22 | `-0.012em` | 600 | Card titles |
| `text-body` | 15 / 21 | `-0.006em` | 400 | Body copy |
| `text-callout` | 14 / 19 | `-0.003em` | 400 | Secondary copy |
| `text-footnote` | 13 / 18 | `0` | 400 | Metadata |
| `text-caption` | 11 / 14 | `+0.01em` | 500 | Chips, labels |

### 1.4 Density: compact phone, spacious desktop

One set of custom properties that shift at `768px`, so components declare
`padding: var(--pad-card)` once and adapt automatically.

| Token | Mobile | Desktop |
|---|---|---|
| `--pad-page-x` | `16px` | `40px` |
| `--pad-card` | `12px` | `18px` |
| `--gap-list` | `8px` | `12px` |
| `--gap-section` | `28px` | `44px` |
| `--radius-card` | `14px` | `18px` |
| `--control-h` | `44px` | `36px` |

Note the control height inverts: **44px on mobile** is the minimum comfortable
touch target, while desktop can be tighter with a precise pointer. That single
row fixes most of "mobile experience is weak".

### 1.5 Icons: one set, no emoji

Two problems today. Emoji are doing real UI work (~98 of them across 32 distinct
glyphs) and they render as a different picture on every OS, at a size and weight
you cannot control. And `react-icons` is pulling from **five** sets at once (bi,
fa6, fi, io5, lu), each with its own grid and stroke weight, which is a direct
cause of "inconsistent page to page".

**Standardize on Lucide** (`lucide-react`). Uniform 24x24 grid, single tunable
stroke, geometric and neutral. It is the closest free equivalent in spirit to SF
Symbols, and one of the five sets already in use is Lucide, so this is partly
consolidation rather than a new dependency.

House rules: `1.5` stroke at 16-20px, icons inherit `currentColor`, never an
icon alone without a label or `aria-label`, and decorative icons get
`aria-hidden`.

Every emoji currently on screen maps to one:

| Today | Lucide | Where |
|---|---|---|
| ⚡ | `Zap` | Sparks |
| 💡 | `Lightbulb` | Idea bank |
| 💬 | `MessageSquare` | Comments, "I'd discuss this" |
| ▲ | `ArrowBigUp` | Votes |
| 🤝 | `Handshake` | Hand raises |
| ★ | `Star` | Selected topics |
| 🙌 | `HandHelping` | Up for grabs |
| ✍ | `PenLine` | Blog idea |
| 🚀 | `Rocket` | Project showcase |
| 🔬 | `Microscope` | Deep dive |
| 👻 | `Ghost` | Anonymous posting |
| ✅ | `CircleCheck` | Outcomes, done |
| 🚫 | `Ban` | Dropped |
| ↩ | `CornerDownLeft` | Carry forward |
| 🔥 | `Flame` | Hall of Flame |
| 📡 | `Rss` | Bytes |
| 🗓 | `Calendar` | Meeting date |
| 🥇🥈🥉 | `Trophy`, `Medal`, rank numerals | Leaderboard podium |
| 👀 🙋 🤔 🛠 | `Eye`, `Hand`, `MessageCircleQuestion`, `Wrench` | Topic signals |
| 🧠 🎨 ☁️ 📊 🔐 🔧 ⚙️ 🧭 | `Brain`, `Palette`, `Cloud`, `ChartBar`, `Lock`, `Wrench`, `Cog`, `Compass` | Byte domains |

`◈` stays: it is the wordmark, not an icon.

Emoji survive in exactly one place: push notification copy, where the OS renders
them in the notification tray and an SVG cannot go.

### 1.6 Motion

Critically damped springs by default (`bounce: 0`, `duration: 0.3` to `0.4`).
Bounce only after a gesture that carried momentum. Feedback on pointer-down.
Transform and opacity only. All of it collapses to a cross-fade under
`prefers-reduced-motion`.

---

## 2. Work order

Components before pages, since pages are compositions. Each phase ends building
and lint-clean at baseline.

### Phase 0 - Foundations and cleanup
- Rewrite the `@theme` block with the tokens above
- Add the density custom properties and breakpoint shift
- Add the type scale utilities
- Install `lucide-react`; add an `Icon` wrapper that fixes stroke and size
- **Delete dead code:** `CycleStatusBanner`, `VoteButton`, `ContribButton` (zero
  references) and the `TopicForm` stub

### Phase 1 - Primitives (`src/components/ui/`)
`Surface` (elevation-aware) · `Button` (4 variants x 3 sizes, 44px on mobile) ·
`Chip` (replaces Badge) · `Field` (Input, Textarea, Label, counter) · `Sheet`
(replaces Modal, bottom-sheet on mobile) · `Avatar` · `Skeleton` · `EmptyState` ·
`SectionHeader` · `PageHeader` · `StatTile` · `Row` (list primitive) · `Toolbar`

### Phase 2 - Domain components
`TopicCard` · `ByteCard` · `IdeaCard` · `SignalRow` · `CommentThread` ·
`AskPanel` · `SparkButton` · `MeetingPill` · `OutcomesRecap` · `BytesTeaser` ·
`NavLinks`

Each one also swaps its emoji and any `react-icons` import for Lucide, so the
icon migration lands with the component rather than as a separate sweep. Once
the last one is done, `react-icons` is removed from `package.json`.

### Phase 3 - Pages, in traffic order
1. **Board** - the dashboard, where everyone lands
2. **Topic detail** - the deepest screen, most components on it
3. **Bytes** - the weekly habit
4. **Bank** - low traffic, simple
5. **Leaderboard** - podium plus spark picker
6. **Profile** - simple
7. **Admin** - dense, single user, last
8. **Login and landing** - first impression, but rarely seen twice

### Phase 4 - Polish
Reduced motion, reduced transparency, high contrast. Focus-visible rings
throughout. Real-device mobile pass at 375px. Keyboard traversal of every
interactive element.

---

## 3. What this explicitly does not change

Behavior. No API, schema, permission or copy changes beyond labels the redesign
touches. Migrations 011 to 015 stay pending and unrelated. If a screen's logic
is wrong, that is a separate conversation from how it looks.

---

## 4. Checkpoints

After each phase: build clean, lint at baseline (27 errors / 7 warnings, all
pre-existing), and a screenshot or description of what changed. Steer at any
checkpoint.
