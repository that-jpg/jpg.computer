# /ub rework — Today / Ongoing Projects / Metrics & Trends

Decision record assembled 2026-08-09 from the wayfinder map
[that-jpg/ubermensch#1](https://github.com/that-jpg/ubermensch/issues/1)
(tickets #2–#7). Settled; build against this. Detail beyond a line here lives
in the linked ticket's resolution comment.

## Goal

Split the single /ub page into three: **Today** (what I need to do today),
**Ongoing Projects**, and **Metrics & Trends**. The old page's goal cards and
panels dissolve fully into the new pages — nothing keeps two homes. Scope
covers both sides: these pages + `api/ub.js` here, and the producer changes in
the ubermensch repo.

## Shell

`/ub` **is** the Today page. Header nav on every page:
**Today | Projects | Metrics | Calendar**. Same login/session as now.
`/ub/calendar` is untouched except for gaining the nav.

## Today (`/ub`) — [#3](https://github.com/that-jpg/ubermensch/issues/3)

Bands, top to bottom: **weekly-goals strip → overdue todos → due-today todos →
today's calendar events → dailies → habit diamonds**, completed items sunk into
the done band. Interaction model (state cycle, folds, styling) unchanged.

- **Weekly-goals strip** (amendment, 2026-08-09 grilling — a narrow exception
  to "strictly nothing ambient": a hand-chosen commitment list, not computed
  telemetry). The week's 3–5 free-text intentions, checkable, written at the
  Sunday review. Its own entity: no due dates, no project tags — a goal that
  wants either is a todo and belongs in the inbox. Compact: week label +
  single-line goals, small type, **no card chrome** (borders/meters/counts =
  demotion). Checked goals strike through in place — the strip stays a
  complete picture of the week; goals never enter the done band and never
  count toward "N left". CRUD: check/uncheck, add, edit text, delete; no
  reorder. Lifecycle: the list carries an ISO week stamp; on mismatch the
  strip renders stale-grey ("last week") until a deliberate **start-new-week**
  action — clears checked goals, presents unchecked ones for an explicit
  keep-or-delete pass, restamps (on a Sunday it stamps the *coming* week).
  Nothing auto-clears; an empty stamped week is valid ("no goals this week" —
  covers trip weeks). The journal weekly-review section is the only archive,
  by hand; no automated bridge.
- The undated inbox **leaves this page** (display and triage move to
  Projects). The add-form stays and still captures into the inbox; drag-reorder
  moves with the inbox.
- **Strictly nothing ambient**: no project next-actions, no pace badges, no
  goal cards. An item reaches Today only by due date (or overdue), being a
  daily, or being on the calendar. Promotion happens by stamping `due: today`
  during triage on the Projects page.
- The 7-day deficit panel, kcal chart, weight/cut panel, french and finance
  panels all leave with the split (fitness/french/finance → Metrics, goal
  cards → Projects).

## Ongoing Projects — [#4](https://github.com/that-jpg/ubermensch/issues/4)

Two sections plus the inbox; header shows an `N unsorted` count linking down.

1. **This month's goals** (top): the existing goal-card component moved over
   as-is and permanently unfolded — meters, pace, tagged todos, `+N scheduled`
   / done folds. `august — N behind pace` becomes the section heading.
2. **Side-projects**: one card per entry of a new hand-edited registry
   `goals/projects.json` in ubermensch —
   `{slug, title, status: active|paused, note?}`. Slug = the todo `project`
   tag. Cards show title + note + open todos (state cycle, due-sorted, due
   chips), done todos folded, and a per-card add that lands items pre-tagged.
   **No meters on side-project cards** — a project earning a meter is a
   promotion to monthly goal. `paused` renders dimmed/collapsed at the
   section's end; finished projects are deleted from the file; a slug with
   todos but no registry entry renders as a plain untracked card.
3. **Inbox** (bottom): triage per item — `#` project chip (moves it onto that
   card), due-date stamp with one-tap **today**, delete, drag-reorder.
   Dated-but-unprojected items leave the inbox and surface on Today on their
   due day (existing behavior).

## Metrics & Trends — [#5](https://github.com/that-jpg/ubermensch/issues/5)

Four sections, ranked **Fitness → French → Finance → Ventures**. Redis holds
no history, so every series is pushed by its producer from local files
(contract below).

- **Fitness**: weight vs cut plan with start/checkpoint/target trajectory,
  full series (hero chart); calories-in daily bars vs target, ~30 days
  (missing bar = unlogged day); training sessions/week vs the 7/week goal.
  **No deficit trend** while calories-out is imputed (stale since
  2026-06-28); the deficit snapshot dies with the old panel.
- **French**: 7-day rolling review accuracy (the month-end goal metric);
  reviews/day vs quota (full reconstruction from `agares_history.jsonl`);
  vocab-known series born at first deploy, current numbers as a stat tile
  meanwhile.
- **Finance**: net worth per statement date; monthly spend-by-category
  stacked bars; current allocation. Honest empty states until statements are
  ingested.
- **Ventures**: Stolas followers vs the 250-by-Sept-30 pace line; iwa
  cumulative pieces thrown vs the 27-piece plan (empty state until
  `production.csv` begins). Brand-of-gods: ledger stat panel (net cash,
  per-SKU stock, contribution per sold unit vs plan, per-unit + per-channel
  detail tables) — added 2026-08-11; still no chart until the ledger has real
  rhythm.

## Data contract — [#6](https://github.com/that-jpg/ubermensch/issues/6)

Series live on each domain's existing key; the Metrics page reads four keys.

Unchanged: `ub-todos`, `ub-calendar`, `ub-calendar-done`, `ub-goals`
(Projects reads the goal cards, Today reads the `today` habits block).

| Key | Producer (ubermensch) | Change |
| --- | --- | --- |
| `ub-fitness` | `fitness/dashboard_push.py` | + `weight_series` (all `{date,kg}`), `kcal_series` (30 days `{date,in,target}`), `training_weeks` (`{week,sessions}`); old 8-day `days`/deficit block dies when the old panel does |
| `ub-french` | `journal/bot/agares/agares_dashboard.py` | + `accuracy_series` (daily `{date,reviews,correct}`; 7-day rolling computed site-side), `vocab_series` (`{date,known,introduced}`) |
| `ub-finance` | `journal/bot/bune/bune_dashboard.py` | `month` block → per-month `months[]` (`{month,income,spend,net,by_category}`) |
| `ub-projects` (new) | `goals/push.py` | `{updated, projects:[{slug,title,status,note}]}` from `goals/projects.json` |
| `ub-ventures` (new) | `goals/push.py` | `{updated, stolas:{followers[], target, target_date, pace anchors}, iwa:{pieces[], target}, brand_of_gods:{rows, last_date, cash, units, unit_econ, channels}}` (brand_of_gods added 2026-08-11 from `dreams/brand-of-gods/ledger.jsonl`; `{error}` when the ledger fails validation) |
| `ub-week-goals` (new) | — none; `api/ub.js` is the sole writer | `{week: "2026-W33", goals:[{id,text,done}]}` — dashboard-mutated only (add/edit/check/delete + start-new-week restamp); must be its own key since `goals/push.py` SETs `ub-goals` wholesale |

- New local snapshot file `journal/bot/agares/agares_vocab_history.jsonl`
  (gitignored): one `{date,known,introduced}` line appended on the first push
  of each day.
- `api/ub.js`: two new GET actions, `projects` and `ventures`, plus the
  `ub-week-goals` read + mutations (the only new mutations in the rework;
  everything else — `#` chip, due stamping, add, delete — exists).
- Cadence: the 15-min `dashboard-push.timer` plus existing event pushes
  (french after Anki replies, finance after ingests). No retention rules —
  series are small; full history pushed.

## Data reality — [#2](https://github.com/that-jpg/ubermensch/issues/2)

Inventory taken 2026-08-09 (full tables in the ticket): fitness is the richest
history (48 nutrition days, 26 weigh-ins, 23 sessions since June); french is
reconstructable from `agares_history.jsonl`; finance files are near-empty
(one June Nubank CSV ever ingested); iwa has no data; stolas has a clean daily
follower CSV. `calories_out.csv` stale since 06-28 → deficits since are
TDEE-estimates, hence the no-deficit-trend rule.

## Out of scope

- `/ub/calendar` (beyond the nav), the `pomodoro` / `planning_slot` APIs.
- Reviving Garmin calories-out collection; ingesting the XP/BTG/Nubank
  statement backlog (Bune's `bune_overdue` nag owns that habit — the charts'
  empty states are the dashboard's nudge).
- No prototypes were made; layout gets reacted to live during the build.
