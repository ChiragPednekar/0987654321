# Prompt: CaseCode design refresh (patterns borrowed from a reference product)

Paste everything below the line into a coding agent working in this repo.

---

## Who you are building for

CaseCode is a practice platform for MBA students and early-career business
graduates preparing for consulting, product, marketing, finance and general
management placements. They solve business cases (profitability, market entry,
pricing, growth, M&A, guesstimates), take AI mock interviews, practise
aptitude, SQL and Excel, do group discussions, and get placement reports. Their
teachers and college placement cells use the same app.

These users are not engineers. They live in slides, spreadsheets and frameworks.
The interface should feel like a sharp consulting workbook: calm, structured,
numerate, and quick to scan. It should never feel like an IDE.

## What this task is

I studied a coding-practice product built for hardware engineers and noted the
design patterns that make it feel organised and motivating. Bring those
**patterns** into CaseCode, translated for business students. Do **not** copy
its look: it is dark-only, violet, dashed-border, monospace-heavy "engineering
blueprint" styling, and that is wrong for our audience and our brand.

## Ground rules (read before you write any code)

1. Read `AGENTS.md`. This repo's Next.js has breaking changes; check
   `node_modules/next/dist/docs/` before writing routing, data or layout code.
2. **Keep our visual identity.** CaseCode uses an Apple HIG theme defined in
   `src/app/globals.css`: grouped grey page + white cards (dark: black / #1C1C1E),
   system blue `--brand` / `--action`, SF Pro stack (`--font-text`), SF Rounded
   for figures (`--font-round`), capsule buttons, segmented-control tabs, glass
   only on the header, sidebar and menus. The vermilion `--mark` is our one
   signature colour and is used **only** for marking (the logo tick, circled
   scores). Do not introduce violet, a dark-only mode, or new brand colours.
3. **Reuse primitives before writing new ones**: `src/components/ui/*`
   (button, badge, card, tabs, progress, select, dialog, avatar, skeleton),
   `stat-card.tsx`, `section.tsx`, `command-palette.tsx` (already has ⌘K),
   `theme-toggle.tsx`, `sparkline.tsx`, `skill-radar.tsx`, `score-trend.tsx`.
   Extend them; don't fork them.
4. Every new colour is a token on `:root` with a dark-mode value, and all text
   meets 4.5:1 contrast in both themes. No text smaller than 11px.
5. One filled (prominent) button per view. Everything else is secondary or plain.
6. Monospace (`--font-code`) is allowed only inside the SQL and Excel
   workspaces and for code. Everywhere else, metadata uses SF at a small size
   with `tabular-nums` for figures. Eyebrows are SF medium, not mono small caps.
7. Don't hide pages or menu items to gate features. Everyone signed in sees
   everything; solving is gated by `canSolve()` / `has_pro`, and complimentary
   accounts must keep full access.
8. Copy is sentence case everywhere (nav, titles, buttons, tags): "Preparation
   plan", "Group discussions", "Market entry". The nav label and the page title
   must be the same string.

## Patterns to bring in, translated for CaseCode

### A. A single page header for every page
Build one `PageHeader` component and use it on **every** student, teacher,
placement and admin page so gutters and header heights are identical
everywhere. Structure, top to bottom:

- **Eyebrow**: the section the page belongs to ("Practice", "Learn",
  "Compete", "Track", "Teach", "Placement"), SF medium, 12–13px, muted.
- **Title**: Large Title weight. On the dashboard, a time-of-day greeting with
  the first name in `--brand`: "Good evening, Chirag." (morning / afternoon /
  evening by the user's local time).
- **Subtitle**: one muted line saying what the page is for.
- **Stats line**: a small, muted, tabular line of live counts, for example
  "6 tracks · 214 cases · 9 finished" or "3 upcoming · 12 past".
- Optional right-aligned actions slot (one primary button at most).

The page content container (max width, side padding, top offset) is owned by
the layout, not by each page. Pages must not add their own outer padding.

### B. Stat chips on the dashboard
A row of compact chips for the numbers a student checks daily:
**Streak** (days), **Cases solved**, **Average score**, **Rank** (in college or
overall), **Interview readiness**. Each chip has its own muted tint drawn from
our status hues via `color-mix` with `--card` (the existing `--x-surface` /
`--x-border` approach), a label in words, and the figure in SF Rounded. Colour
never carries meaning alone. Keep the existing larger `StatCard` for detail
pages; chips are the compact version.

### C. Track cards (Paths, Preparation plan, Cases by track, Companies)
A track is a themed set of cases: Consulting fundamentals, Profitability,
Market entry, Pricing, Product sense, Marketing & GTM, Finance & valuation,
Operations, Guesstimates, or a company set. Card anatomy:

- A tile with a simple line illustration in `--brand` (2×2 matrix, issue tree,
  bar chart, funnel, briefcase, gauge). One consistent stroke weight and size.
- Title, then a capsule badge "4/25 solved".
- A thin progress bar with "21 left" on the left and "16%" on the right.
- A divider, then a footer row: "Next → Coffee chain profitability decline".
- Optional "For your goal" badge, top right, when the track matches the
  student's target role or target school.
- Cards in a grid are equal height; if a card has no prerequisites or extra
  detail, the footer sits at the bottom, not floating with a dead band below.

### D. Difficulty indicator
A small 3-bar signal icon plus the word: Foundation (1 bar), Intermediate
(2 bars), Advanced (3 bars), using success / warning / danger hues. Each level
has a solid, a tinted background and a border token. Use it in case rows, case
detail, and track cards. Always show the word beside the bars.

### E. Case rows and tags
In case lists: title, then a muted category line, then tags separated by
" / " in `--brand`, e.g. "Profitability / Retail / Cost reduction". One tag
vocabulary in one place (a typed list in `src/lib`), sentence case, no
kebab-case, no duplicates. Add a test that every case's tags come from that
list and that framework tags don't contradict the case type.

### F. Filters, search and keyboard hints
- Filter dropdowns show a muted label and a bold value ("Difficulty  All");
  the menu marks the selected item with ✓ and a tinted row.
- Search fields have the icon on the left and a ⌘K keycap on the right that
  opens the existing command palette.
- Show keyboard hints where they exist: ⌘K search, ⌘↵ submit answer in the
  case workspace, `/` to search settings. Keycaps use a shared `Kbd` component
  and must pass contrast; never dim them below the muted text token.

### G. Tabs
Page-level tabs use our existing segmented control. Inside a workspace
(case solving, interview, SQL, Excel), use one secondary tab style for every
panel on that screen. Never mix two tab styles on one screen.

### H. Buttons
- Primary: filled `--action`, white text, trailing arrow where it moves you
  forward ("Start case →", "Begin interview →").
- Secondary: tinted or outlined `--brand` ("Join a classroom", "Bookmarks").
- In the case workspace, "Submit answer" is the only primary. "Check my
  structure" / "Get a hint" are secondary.

### I. Case workspace status bar
A thin bar under the answer editor: left side "Step 3 of 7 · 412 words ·
Saved 10s ago"; right side a status in words with a success tick, e.g.
"✓ Structure complete" or "2 steps left". In SQL/Excel workspaces the left
side can show "Ln 4, Col 12 · PostgreSQL". Proctored cases keep their camera
status visible here too.

### J. Competitions, contests and group discussions
- A stacked date block (NOV / 14 / FRI) in a bordered rounded square on each
  event row.
- Upcoming first, then past **newest first**. Don't list an event with 0 cases
  or 0 participants as if it were real; show "Draft" or hide it from students.

### K. Leaderboard
- Ranks 1–3 in tinted capsule badges; the rest plain muted figures.
- Score bold, secondary figures muted and tabular.
- Fixed row height whether or not a student has a college / batch subtitle
  (reserve the line).
- One avatar fallback style everywhere: first + last initial ("CP"), same
  size, same colour rule (derived from the user id), same as Settings.

### L. Empty states
One `EmptyState` component: a fixed-size icon or line illustration (pick one
size and use it everywhere), a short bold line, one muted helper line, and at
most one action. E.g. "No assignments yet" / "Your teacher hasn't set any
cases for this batch." Use it on every list that can be empty.

### M. Ghost "add" cards
Where a grid lets you add something ("Join a classroom", "Start a study
group", "Add a target company"), the last cell is a ghost card: dashed
`--border`, centred "+" and label, same height as its neighbours. This is the
**only** place dashed borders appear.

### N. Appearance picker in Settings
Replace the plain Light / Dark / System choice in Settings with three preview
cards (System, Light, Dark; add High contrast only if we already support it via
`prefers-contrast`). The selected card gets a `--brand` border and a check
badge. The top-bar Appearance menu stays.

### O. Hover and depth
Cards brighten their border on hover (a stronger `--border`), they don't
change colour. Dropdowns keep our glass treatment with a soft large shadow and
a faint 1px ring. No glow effects.

## Mistakes the reference product makes. Don't repeat them

Treat each of these as an acceptance check:

1. The sidebar must never overlap content on first load, at any width, for any role.
2. Counts come from one source. If the dashboard, Paths and Cases each say how
   many tracks exist, they must agree (derive them from the same query/helper).
3. Identical left gutter and header top offset on every page (measure it).
4. Every page has an eyebrow.
5. Nav label == page title, sentence case.
6. One tag casing; no tag contradicts its case.
7. Badge names and their descriptions match (if the badge is "First case",
   the hint says "Solve your first case to earn First case").
8. Past events newest first; no "0 cases" events shown to students.
9. One avatar fallback style, first + last initials.
10. Fixed leaderboard row height.
11. One empty-state icon size.
12. One primary button per screen.
13. Tables never clip: wide tables scroll inside their container; all header
    labels share one casing.
14. No internal IDs, slugs or template names in the UI.
15. One tab style per screen.
16. Equal card heights in a grid.
17. No text falling back to a generic system font outside our font stacks.
18. All text, including hints and keycaps, passes 4.5:1 in light and dark.
19. Anything featured from users (activity feeds, GD highlights, group posts)
    is filtered: no gibberish, profanity or empty posts reach a featured slot.

## How to work

1. **Phase 1, foundations.** Add any new tokens to `globals.css` (light and
   dark), then build `PageHeader`, `StatChip`, `DifficultySignal`, `TrackCard`,
   `EmptyState`, `GhostCard`, `Kbd`, `DateBlock`, `RankBadge`, the avatar
   fallback rule and the tag vocabulary. Stop and show me screenshots of each in
   light and dark before rolling out.
2. **Phase 2, roll-out.** Apply them page by page: dashboard, cases, paths,
   preparation plan, companies, competitions/contests, leaderboard, group
   discussions, groups, classrooms, bookmarks, certificates, settings, the
   case workspace, then teacher, placement and admin pages.
3. **Phase 3, verify.** Run the app and check every page as a student, a
   teacher, a placement officer and an admin (sign in as throwaway test users;
   a signed-out sweep hides real bugs). Check at 375px and desktop, light and
   dark. Go through the 19 checks above and report each as pass or fail with
   evidence. Run the test suite and type-check.

Keep diffs focused on presentation. Don't change scoring, quotas, gating,
proctoring or any database logic as part of this work.
