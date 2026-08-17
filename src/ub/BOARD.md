# /ub task board — kanban per project + all-view

Decision record assembled 2026-08-17 from the wayfinder map
[that-jpg/ubermensch#8](https://github.com/that-jpg/ubermensch/issues/8)
(tickets #9–#18). Settled; build against this. Each section gists one ticket
and links its resolution comment, which holds the detail. Vocabulary is the
ubermensch `CONTEXT.md` § Task board glossary; where a resolution says
"daily / auto-daily", read **routine / auto-routine** (renamed in
[Recurrence rules](https://github.com/that-jpg/ubermensch/issues/18#issuecomment-5318260222)).
Supersedes the Today and Ongoing Projects sections of [PLAN.md](./PLAN.md);
Metrics & Trends, Calendar and Física 3 stand, amended only where stated here.

## Destination

A Kanban board built into /ub that replaces the Today and Projects pages: one
board per project plus an all-view, where routines, date-pinned tasks and
calendar events surface as cards on their day. Covers pages/nav, the board +
card model, Redis/API contracts, bot changes, and the migration off
Today/Projects. Metrics gains only the goal meters; Calendar and Física 3 are
untouched.

## Framing (locked while charting)

- Built into /ub — no external tracker; kanban, continuous flow, no sprints.
- Fixed columns **Backlog / Todo / Doing / Done** on every board, plus a
  **Today swimlane**; **one board per project + an all-view**.
- Projects are the ongoing side-efforts; monthly goals are not projects —
  their meters move to Metrics.
- Bots keep writing as they do; untagged captures land in an **Inbox**.
- Desktop-first; the phone gets a Today list only.
- No prototype: layout is reacted to live during the build.

## 1. What the board replaces — [Inventory](https://github.com/that-jpg/ubermensch/issues/9#issuecomment-5316086879)

Full tables in ubermensch `research/ub-board-inventory.md`.

- Today (`/ub/`): notes-count widget, "since became a God" timer, weekly-goals
  strip (`ub-week-goals`, site-only key), add-form with a `daily` chip,
  `N left`, overdue / due-today / event rows / dailies / habit diamonds
  (read-only from `ub-goals.today`), done band, `done (N)` fold. No drag.
- Projects (`/ub/projects/`): `august — N behind pace`, goal cards (meters +
  tagged items + folds + per-card add), side-project cards from an empty
  registry, drag-reorder inbox with one-tap `today` (= `due: today`).
- `ub-todos`: nine fields written identically by site and bot; array position
  is the order; `text`/`kind` immutable; done never pruned; the bot writes
  whole-array without CAS; journal `done:` logging is bot-side only.
- Live at survey: 100 items — 7 open globals (all dated-future and goal-tagged),
  inbox empty, 3 dailies, 90 done (55 without `doneOn`).
- Shell: Vite MPA entries in `vite.config.ts` + per-entry `index.html`; no
  Vercel rewrites; `redirectToLogin()` and every nav link point at `/ub/`.

## 2. Board shape — [Today lane semantics](https://github.com/that-jpg/ubermensch/issues/10#issuecomment-5317724274)

- **Today is a swimlane** across the columns of every board; a **Later**
  swimlane below holds the Backlog and every undated/future card. A card in
  Today still occupies Todo, Doing or Done — nothing renders twice; done-today
  cards sit in Today × Done. Backlog has no Today cell; pinning a Backlog card
  commits it to Todo.
- **Date-pinned cards** enter Today when `date ≤ today` and not done. Each
  carries a per-card rule for an unfinished day end: **carries** (default —
  stays in Today tinted overdue until done, re-dated or un-pinned) or
  **expires** (closed as done at day end; expired is plain done, not a
  distinct outcome). Un-pin = clear the date → Later.
- **Ordering** inside a Today cell: overdue oldest first → today's dated →
  routines → auto-routines (by start time on the Calendar board); Today × Done
  by completion, newest last. The human may **drag within Today**; that order
  persists for the day. Later/Backlog keep free drag.

## 3. Routines and auto-routines — [Today lane semantics](https://github.com/that-jpg/ubermensch/issues/10#issuecomment-5317724274) · [Recurrence rules](https://github.com/that-jpg/ubermensch/issues/18#issuecomment-5318260222)

- A **routine template** is owned by a project (not a card; retiring =
  deleting the template). Each due morning it spawns a **real routine card**
  into that board's Today × Todo. Checked → Today × Done for the day. Left
  unchecked → stays as a dated **miss** and leaves Today at midnight — never
  overdue, never carried; history holds done days and missed days as cards.
- **Recurrence rules — three only**: every day; chosen weekdays (a one-day
  mask is a weekly routine, e.g. the Sunday review); monthly on a date.
  N-per-week targets are Metrics meters, not spawn rules.
- **Away**: global date ranges set on the boards page; each template has a
  *spawns while away* flag (default no); suppressed days spawn nothing and
  record no miss. Holidays are not special.
- **Auto-routines** replace the habit diamonds: routine cards whose done state
  is derived from data (food JSON, weight.csv, agares history, training.jsonl,
  stolas state), read-only ◇/◆ on the project they serve. Two modes per
  template: **always-spawn** (food, weigh-in, anki, agares, ig — a miss is
  real) or **on-signal** (training, stolas approve — the card appears only
  when the signal fires; no misses). Signals are code, not user-editable; a
  stale snapshot greys the card.
- Weekly/monthly routines share the daily lifecycle — one miss on their day.
- Templates are edited in a **board-level templates editor** (header entry);
  a spawned card's panel links "from template …" into it.

## 4. Calendar board — [Today lane semantics](https://github.com/that-jpg/ubermensch/issues/10#issuecomment-5317724274)

- Calendar events live on a dedicated **Calendar board** (system board, no
  project, outside the registry): Today = the day's agenda, Later × Todo = the
  coming events in the `ub-calendar` window, Backlog empty.
- Cards are read-only (created in the calendar apps); the todo → doing → done
  cycle stays in `ub-calendar-done`; an ended-but-unmarked event dims in place,
  then expires to done at day end. Calendars in `calendar_today_exclude` never
  appear on the board (still on /ub/calendar).

## 5. Cards — [Card anatomy and lifecycle](https://github.com/that-jpg/ubermensch/issues/11#issuecomment-5317812682)

- **Fields**: title, kind, board, column, optional date + carries/expires,
  created and done stamps; a **task** adds a **description** (free text,
  links live there) and a **checklist** (sub-steps, done count on the face).
  No labels, priority, estimates or `updated` stamps.
- **Kind is first-class**: `task` / `routine` / `auto-routine` / `event`. It
  fixes source and editability (task fully; a routine's title only via its
  template; auto-routine and event read-only) and shows as a glyph. Every kind
  shares the tri-state cycle.
- **Done retention**: Today × Done = done today; Later × Done = the last 7
  days; after 7 days a card leaves the board into an **archive** (kept, never
  auto-deleted, Metrics reads history from it, browsable via a fold/link).
  Deletion is always manual.
- **Journal `done:` lines**: a nightly ubermensch job appends one line per
  **task** card completed that day (any source), deduped by card id;
  routines, auto-routines, events and expired cards excluded. Vassago and
  `jj todo` stop journaling at completion time.
- **Editing**: card face keeps inline quick actions (state toggle, drag, date
  chip, project chip); clicking the title opens a **card detail panel**
  (editable title — titles become editable — description, checklist, date +
  carries/expires, project, kind, stamps, delete); read-only kinds open the
  panel read-only. Bot-side editing unchanged.
- **Identity**: ids stay UUIDv4; each **task** gets a per-project **display
  key** (`IWA-12`), minted from the project's counter when the task first
  lands on that board (created there or triaged from the Inbox), kept on later
  moves. Inbox tasks are keyless; other kinds show their glyph.

## 6. Projects, Inbox, boards — [Project entity and Inbox](https://github.com/that-jpg/ubermensch/issues/12#issuecomment-5317941029)

- **Registry is board-managed, in Redis** (API-owned): slug, title, key
  prefix, note, status, templates. `goals/projects.json` and `ub-projects`
  retire. Slug rule stays `^[a-z][a-z0-9-]{0,23}$`.
- **Lifecycle: active · paused · archived, never deleted.** Active: on the
  all-view and nav, templates spawn. Paused: reachable from the boards page,
  hidden from the all-view, no spawns, keys kept. Archived: read-only and
  hidden, cards and keys preserved.
- **Nine boards at cutover** + the built-in Calendar board:

  | slug | prefix | auto-routines |
  | --- | --- | --- |
  | fitness | FIT | food logged, weigh-in, training logged |
  | french | FRE | anki, Agares answer |
  | stolas | STO | approve queue (on-signal), ig engagement |
  | iwa | IWA | — |
  | defiant | DEF | — |
  | brand-of-gods | BOG | — |
  | fisica3 | FIS | — |
  | ubermensch | UB | — |
  | home | HOME | — |

  Legacy goal tags map `cut → fitness`, `iwa → iwa`, `defiant → defiant`,
  `housekeeping → home`.
- **Física 3**: both — the fisica3 board holds study tasks/routines; the
  `/ub/fisica3` ledger page stays as is (Vapula's) and the board header links
  to it; no data flows between them.
- **Board header**: title, key prefix, editable note, open-card count, status
  control, templates-editor entry (fisica3 adds the ledger link). **Board add
  lands at the top of Backlog**; a date at add time sends it to Todo + Today.
- **Inbox = a lane on the all-view**, not a board; cards keyless and dateless.
  Triage per card: project chip → that board's Backlog (Todo + Today if dated
  at the same time), date stamp with one-tap today (**always asks for the
  project first**, default `home`), delete, drag order. A card leaves the
  Inbox the moment it has a project.
- **Key prefix**: hand-set at creation, default slug uppercased, unique,
  immutable once a key exists.

## 7. All-view, routing, nav, phone — [All-view, nav and the phone Today list](https://github.com/that-jpg/ubermensch/issues/13#issuecomment-5318065114)

- **`/ub/` is the all-view**, top to bottom: weekly-goals strip (notes count
  and the timer stay beside it) → **Inbox lane with the add-form** (plain
  text → Inbox; project chip/date at add time bypasses it) → **one Today
  swimlane per active board** (Todo / Doing / Done cells), Calendar first
  then hand-set order, empty lanes hidden. Nothing from Backlog or Later.
- **Rule: Doing implies Today** — moving any card into Doing stamps today
  (carries); no separate in-flight strip.
- Boards at **`/ub/board/<slug>/`** (one entry + a Vercel rewrite); a
  **boards page** at `/ub/boards/` (all boards, status controls, create).
  Header nav on every page: **all · boards · metrics · calendar · física 3**;
  calendar and fisica3 pages adopt the shared nav. Same login/session.
- **Phone**: viewport breakpoint on the same pages. The all-view renders as a
  list — strip, Inbox (with add-form), then today's cards grouped by board
  (Todo/Doing first, Done sunk) — with state toggle, routine check, read-only
  panel, add-to-Inbox. No drag, no Later, no columns; a board URL shows only
  that board's Today.
- **No cross-board drag** on the all-view; project changes go through the chip.

## 8. Metrics: the Month section — [Goal meters move to Metrics](https://github.com/that-jpg/ubermensch/issues/14#issuecomment-5318155811)

- A **Month section at the top of Metrics**: `august — N behind pace` /
  `on pace`, one compact row per goal (title + meter bars with pace ticks,
  red when behind), `as of HH:MM`; zero-meter goals don't render. Everything
  else on the old goal cards dies. `MeterBar` moves as-is.
- Current month only, no history: a new month = new `goals/<month>.md` +
  swapped `push.py` constants; empty month renders "no goals set".
- `goals/<month>.md` stays the intent; `goals/push.py` stays the producer;
  **`ub-goals` slims to `month / title / updated / goals[] / notes`** and
  drops the `today` habit block. The notes count stays on the all-view.

## 9. Data contracts — [Data contracts](https://github.com/that-jpg/ubermensch/issues/15#issuecomment-5318322647)

Decisions:

- **Storage: `ub-todos` evolves in place** as the single cards array (Inbox =
  cards with no project) + API-owned **`ub-board-registry`** + monthly
  **`ub-board-archive:<YYYY-MM>`**.
- **`todo_store.py` becomes an API client** with a static bot bearer token
  (`UB_BOT_TOKEN` on Vercel; `ub_api_url` + `ub_api_token` in
  `journal/bot/config.json`) accepted alongside sessions — one writer,
  per-item semantics everywhere.
- **Day rollover runs in the API, lazily and idempotently** (first
  authenticated read after local midnight; `POST rollover` for a timer):
  spawn / expire / archive. **Auto-routine truth is `ub-board-signals`**,
  pushed every 15 min by ubermensch.
- **Calendar cards are projected** at read time from `ub-calendar`; state
  stays in `ub-calendar-done` (8-day prune unchanged); nothing written.
- WIP limits / stale Doing: out of scope for v1.

Keys:

| Key | Owner | Shape |
| --- | --- | --- |
| `ub-todos` | API (bots via API) | cards — `id` · `text` · `kind` task/routine/auto-routine · `project` slug/null · `column` backlog/todo/doing/done · `date` · `expires` · `key` · `description` · `checklist[{id,text,done}]` · `template` · `signal` · `order` · `todayOrder` · `created` · `doneOn` · `doneVia` tap/expiry/signal · `journaled`; `state`/`done` kept as derived mirrors |
| `ub-board-registry` | API | `{updated, lastRollover, projects:[{slug, title, prefix, note, status, order, counter, templates:[{id, title, kind, rule:{type: daily/weekdays/monthly, days?, dom?}, whileAway, signal?, mode?}]}], away:[{start,end}]}` |
| `ub-board-archive:<YYYY-MM>` | API | full card objects by `doneOn` month; appended at rollover, never pruned |
| `ub-board-signals` | ubermensch | `{date, updated, signals:{food, weighin, anki, agares, training, stolas_low, ig}}` |
| `ub-goals` | ubermensch | slims; `today` dropped |
| `ub-projects` | — | retires |
| `ub-week-goals`, `ub-calendar`, `ub-calendar-done`, `ub-fitness`, `ub-french`, `ub-finance`, `ub-ventures`, `ub-fisica3`, `ub-session:*` | unchanged | |

`api/ub.js` (session or bot token): `GET all` (all-view + phone; runs
rollover), `GET board&slug=` (`calendar` projected), `GET boards`,
`GET archive&month=`, `GET todos` (legacy bot list shape); `POST cards`,
`PATCH cards` (column/date/expires/project/text/description/checklist/order/
todayOrder — Doing stamps today, Done stamps `doneOn`+`doneVia`, a date on a
Backlog card moves it to Todo, first project mints the key), `DELETE cards`,
`PUT cards-order` (per board+column; unnamed ids go after), `PUT today-order`,
`POST rollover`; registry `POST/PATCH projects`, `POST/PATCH/DELETE templates`,
`PUT away`. Unchanged: `week-goals`, `calendar-done`, `calendar`, `goals`,
`fitness`, `french`, `finance`, `ventures`, `fisica3`, `login`, `logout`.
`vercel.json`: rewrite `/ub/board/:slug` → `/ub/board/index.html`, redirect
`/ub/projects/` → `/ub/boards/`.

ubermensch side (detail in that repo's `STRUCTURE.md` § board): `todo_store.py`
→ API client (`_log_done` removed); `goals/push.py` minus `today_habits()` /
`projects_snapshot()`, `is_trip` reads registry `away`; new `board/signals.py`
(15-min timer + Buer/Agares events), `board/journal_done.py` (23:30 timer),
optional `board-rollover.timer` 00:05; restart vassago / seere / journal bots.
Legacy field defaults for the migration are in the resolution comment.

## 10. Migration and cutover — [Migration and cutover](https://github.com/that-jpg/ubermensch/issues/16#issuecomment-5319144215)

- **Big-bang**: one deploy ships all-view/board/boards and deletes `today/` +
  `projects/`; `/ub/projects/` → `/ub/boards/`; `/ub/` stays the root;
  `ub-week-goals` untouched.
- **`board/migrate.py`** (ubermensch, one-off, idempotent, run before the
  deploy): back up `ub-todos` / `ub-week-goals` / `ub-calendar-done` locally;
  seed the registry (nine projects in the table's order, seven auto-routine +
  three routine templates from today's dailies, `away []`); transform the 100
  items per the legacy defaults; mint keys for the 7 open tasks; archive done
  items older than 7 days by month; delete the 3 legacy dailies; print counts.
- **Deleted from jpg.computer**: `ub-app/src/today/`, `ub-app/src/projects/`,
  `ub-app/projects/index.html`; root `index.html` becomes the all-view;
  `vite.config.ts` input map; `HeaderNav.NAV_LINKS`; hand-coded navs in
  `CalendarPage.tsx` / `Fisica3Page.tsx` → shared nav.
- **ubermensch commit set**: `todo_store.py` client + `config.example.json`;
  `push.py` slim; `goals/projects.json` deleted; `board/signals.py`,
  `board/journal_done.py`, `board/migrate.py` + tests; `server/aiur.md`
  timers; docs (`STRUCTURE.md`, `journal/README.md`, `journal/bot/README.md`,
  `jj` help, memory).

## Build order

1. `api/ub.js`: bot token auth, registry / cards / rollover / archive /
   all / board / boards actions, legacy `todos` GET kept — deployable while
   the old pages still run.
2. ubermensch: `todo_store` → API client (restart bots), `board/signals.py` on
   the timer, `board/journal_done.py` + timer, `push.py` slim, `board/migrate.py`
   dry-run against a copy of the backup.
3. `ub-app`: all-view + board + boards entries, shared nav, Metrics Month
   section, delete `today/` + `projects/`, `vercel.json` rewrite + redirect.
4. Cutover day: run `migrate.py` → deploy jpg.computer → restart bots →
   verify → docs commits.

## Cutover checklist

- All-view shows the active lanes (empty hidden) + Calendar + Inbox; the 7
  migrated tasks carry keys and sit in Today (dated) or Todo.
- A Vassago `add` lands in the Inbox within seconds; `jj todo done 1` closes a
  card and no `done:` line appears until 23:30.
- The first read after midnight spawns routines; auto-routines flip with
  `ub-board-signals`.
- Metrics shows the Month section; `/ub/projects/` redirects.

## Rollback

Restore `ub-todos` (+ `ub-week-goals`, `ub-calendar-done`) from the backup,
redeploy the previous jpg.computer commit, revert `todo_store.py`, restart
bots. Registry / archive / signals keys can stay.

## Out of scope

External trackers; sprints; new bot syntax; a narrow-screen board layout;
Metrics beyond the Month section, `/ub/calendar`, `/ub/fisica3`; building
the board (this is the spec); WIP limits / stale-Doing surfacing.

## As built (2026-08-17)

Cut over the same day the map closed: API `a953b2b`/`6d2b600`, pages
`df05e1a`/`77056b9`, ubermensch `7a660ba`, migration applied with a local
backup (`journal/bot/.ub-backup-2026-08-17T1647.json`). Refinements made
while building, all otherwise per the sections above:

- **Routine and auto-routine cards leave the board at the next rollover** —
  archived as done or as a dated miss — instead of sitting in Later × Done for
  seven days; ten spawned cards a day would have drowned the Done column. The
  seven-day rule applies to tasks.
- **Calendar cards are projected in the client** from the `all` payload
  (`calendar` + `calendarDone`), which is equivalent to the API projecting them
  and reuses the existing event logic; nothing is written.
- **`ub-todos` keeps its key name** as the cards array; the legacy `todos`
  action stays as the bot's numbered view; `state`/`done`/`due` are served as
  mirrors of `column`/`date` in that view only.
- **First read after the API deploy rolled the live data over** before the
  migration script ran (88 done items archived by the API); `board/migrate.py`
  therefore also handles already-normalized cards (retags goal slugs, mints
  keys, turns dateless legacy routines into templates) and is safe to re-run.
- Tests: `node --test tests/api/ub.test.js` (API, in-memory Redis) and
  `cd ub-app && npm test` (57 vitest cases incl. page smoke tests against a
  synthetic `all` payload); ubermensch `python3 -m unittest discover -s
  board/tests` and the bot/goals suites.
- Timers on aiur: `dashboard-push` gained `board/signals.py`;
  `journal-done.timer` 23:30; `board-rollover.timer` 00:05.
- **Amendment (2026-08-17, after first use): an undated open task is "todo
  now"** — it sits in the Today swimlane's Todo cell; only a future date parks
  it in Later × Todo, and Backlog is the one column that never shows in Today.
  Consequently the board add-form, the all-view add-form and Inbox triage land
  cards in **Todo** (Backlog only by dragging or from the panel), superseding
  §2's date-only Today membership and §6's "add lands in Backlog" for undated
  cards. The all-view also lists active boards with nothing in Today as
  "quiet today" links so a new board is visible at once.
