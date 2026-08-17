# Home Console

A household task board: recurring chores are defined once, occurrences are
generated daily, whoever's assigned confirms Done / Not Done / Skipped /
Partial (with a reason), and browser push reminds people before, at, and
after the due time. PIN login for Vishwa, Wife, Kid1, Kid2.

Architecture matches your other apps: React/Vite frontend on Vercel,
Google Sheets as the data store, Google Apps Script Web App as the API
(GET-only, no CORS headaches), GitHub Actions as the scheduler.

```
Frontend (React, Vercel)  →  Apps Script Web App  →  Google Sheet
                            ↑
GitHub Actions (every 10 min) → Vercel function → web-push → browser
```

## 1. Google Sheet + Apps Script

1. Create a new Google Sheet (any name, e.g. "Home Console Data").
2. Extensions → Apps Script. Delete the default `Code.gs` content and
   paste in `apps-script/Code.gs` from this repo.
3. In the function dropdown at the top, select **setupSheets**, click
   Run, and grant the permissions it asks for. This creates the four
   sheet tabs (`USERS`, `TASK_MASTER`, `TASK_LOG`, `PUSH_SUBSCRIPTIONS`),
   seeds your four users with PIN `0000`, and seeds six starter tasks
   from the discussion doc (drinking water tank, washing machine,
   sweep & mop, evening lights, gate lock, weekly outdoor clean).
4. Open **View → Logs** (or the execution log) after running — it
   prints a `CRON_SECRET` value. Copy it, you'll need it below.
5. **Change the PINs**: open the `USERS` sheet and replace `0000` with
   a real 4-digit PIN for each person.
6. Deploy → New deployment → type **Web app**. Execute as **Me**,
   who has access: **Anyone**. Deploy, and copy the `/exec` URL —
   that's your `VITE_APPS_SCRIPT_URL`.
   - Whenever you edit `Code.gs` later, use Deploy → Manage deployments
     → edit → New version, so the `/exec` URL keeps working.

### If you already ran the first version of this script

There was a bug: Sheets silently converts a `"2026-08-16"`-shaped
string typed into a cell into a real Date object, so the `Date`
column in `TASK_LOG` stopped matching the plain string the code
compared it against — tasks would sit in the sheet but never show up
on the Home screen. It's fixed in this version (`toDateKey()` now
normalizes both sides of every date comparison), but you need to:

1. Paste the updated `Code.gs` over your existing script.
2. Run **fixDateColumnFormat** once from the function dropdown — it
   rewrites every existing `Date` cell in `TASK_LOG` back to a plain
   `yyyy-MM-dd` string and locks the column to Plain Text formatting
   so Sheets won't silently convert it again.
3. Same problem hits the `DueTime` column (typing `08:00` gets turned
   into a real time value, which broke sorting with a
   ".localeCompare is not a function" error). Run **fixTimeColumnFormat**
   once too — it repairs `DueTime` in both `TASK_MASTER` and `TASK_LOG`.
4. Deploy → Manage deployments → edit → **New version**.


### Editing tasks later
Everything lives in `TASK_MASTER` — add a row to add a task, no code
changes needed. Columns:

| Column | Meaning |
|---|---|
| `TaskID` | Unique short ID, e.g. `T7` |
| `TaskName` | Shown on the task card |
| `Frequency` | `DAILY`, `WEEKLY:Sun` (or `WEEKLY:Sun,Wed`), or `MONTHLY:15` |
| `DueTime` | 24h `HH:MM` |
| `AssigneeIDs` | Comma-separated `UserID`s (e.g. `U3,U4`), or `ALL` for whoever's free |
| `AssigneeLabel` | Display text, e.g. "Kids" or "Whoever's free" |
| `Priority` | `Critical`, `Important`, or `Routine` |
| `ReminderBeforeMin` | Minutes before due time to send the first push (0 = no early reminder) |
| `RequireRemark` | Not enforced yet in V1 — reserved for later |
| `Active` | `TRUE`/`FALSE` — set `FALSE` to retire a task without deleting history |

Every completed/skipped/not-done action is logged permanently in
`TASK_LOG` and is never overwritten — that's your audit history.

## 2. VAPID keys (for push notifications)

Run this once, anywhere with Node installed:

```bash
npx web-push generate-vapid-keys
```

Save the public and private key — you'll set them as env vars below.

## 3. Vercel

1. Push this repo to GitHub (feature branch, PR into main, per usual).
2. Import the repo into Vercel.
3. Add these Environment Variables (Production + Preview):
   - `VITE_APPS_SCRIPT_URL` — the `/exec` URL from step 1
   - `VITE_VAPID_PUBLIC_KEY` — from step 2
   - `VAPID_PUBLIC_KEY` — same value, used server-side by the API function
   - `VAPID_PRIVATE_KEY` — from step 2
   - `APPS_SCRIPT_URL` — same `/exec` URL, used server-side (no `VITE_` prefix)
   - `CRON_SECRET` — the value Apps Script logged in step 1.4
   - `CRON_TRIGGER_KEY` — any random string you make up, shared with GitHub Actions below
4. Add the domain `home.vishwanathrajasekaran.in` under Project →
   Settings → Domains, same as your other apps.

## 4. GitHub Actions (the notification scheduler)

Apps Script alone can't push to browsers, so a small Vercel function
(`api/send-notifications.js`) does the actual push send, and GitHub
Actions wakes it up every 10 minutes.

1. In the GitHub repo: Settings → Secrets and variables → Actions →
   add a secret `CRON_TRIGGER_KEY` with the same value you set in
   Vercel above.
2. The workflow at `.github/workflows/notify.yml` is already wired to
   `https://home.vishwanathrajasekaran.in/api/send-notifications` —
   update the URL there if you pick a different subdomain.
3. It'll start running automatically once merged to main (GitHub only
   runs scheduled workflows off the default branch).

## 5. Using it

- Open the site, tap your name, enter your PIN.
- Tap **Enable notifications** once per device/browser to opt into
  push — this has to be a tap (browsers require a user gesture before
  asking permission).
- Tasks are grouped by hour ("8 AM · 2 tasks"), with Overdue pinned
  above. Tap a task card to open the action popup — Done confirms
  immediately, Not Done / Skipped / Paused ask for a quick reason
  first.

### Adding categories to your existing sheet

Run **`ensureCategoryColumn`** once from the function dropdown — it
adds a `Category` column to `TASK_MASTER`, defaulting every task to
`Other`. Then open `TASK_MASTER` and set each task's `Category` to
one of: `Outside`, `Room`, `Kitchen`, `Hall`, `Balcony`, `Office Room`
(or any text you like — the frontend just shows whatever's in the
cell as a tag, with a matching icon for those six). To put "clean
wardrobe" or "clean toilet" under Room, add a new task row with
`Category` set to `Room` — no code change needed.

### Giving someone Admin access (see everyone's tasks)

Run **`ensureRoleColumn`** once — it adds a `Role` column to `USERS`,
defaulting everyone to `Member`. Change one person's cell to `Admin`
and they'll see every household member's tasks instead of just their
own (each card still shows who it's assigned to).

## What shipped in this round

- Fixed the Date-matching bug described above (Home screen showing
  no tasks despite Task Log having rows).
- Fixed the same class of bug on the `DueTime` column
  (`.localeCompare is not a function`).
- Fixed a duplicate-occurrence bug: a duplicate `TaskID` row in
  `TASK_MASTER` could generate many duplicate rows in `TASK_LOG` for
  the same task. `dedupeTaskLog()` cleans up an already-affected sheet.
- Calendar picker (tap the 📅 icon) — past/today dates show real
  logged history, future dates show a read-only "Scheduled" preview
  computed from `TASK_MASTER` (no actions, since there's no
  occurrence to update yet).
- **Pause for today** — pauses one occurrence without counting it as
  skipped/not-done and without triggering further reminders for it
  today. Separate from `Active` on `TASK_MASTER`, which pauses a task
  permanently.
- Day/Night theme toggle (☀/☾/◐ icon) — Auto follows local time
  (day 6am–6pm), or force one manually; your choice is remembered.
- **Admin role** — one person can see every household member's tasks
  instead of just their own.
- **Categories** — Outside / Room / Kitchen / Hall / Balcony / Office
  Room (or your own), shown as a tag on each card.
- **Redesigned task list**: tasks are now tap-to-open cards grouped by
  hour, instead of a row with Done/Not Done/Skip always visible inline
  (was overlapping/cramped on phones). Tapping opens a popup with icon
  buttons (✓ ✕ ⏭ ⏸) — Done confirms instantly, the others reuse the
  reason-chip flow.
- Fixed a bug where switching dates via the calendar showed stale
  data with no loading indicator in between.
- A status donut + 24-hour timeline strip on the board (tap a
  timeline dot to jump to that task).
- `getStats(userId, days)` endpoint is in the backend for a future
  multi-day trend chart — not wired into the UI yet.

## What's next (from the discussion doc, not yet built)

- Overhead tank capacity via sensors — once you have a sensor feed,
  it can write into a new sheet tab and a task/alert can be generated
  from it the same way `TASK_MASTER` generates task occurrences today.
- An admin view for adding/editing tasks from the UI instead of the
  Sheet directly.
- Maintenance history (AC, RO, inverter, etc.) as a separate log,
  reusing the same Task/Occurrence/Completion model.
- `CUSTOM` recurrence (every N days) — `Frequency` currently supports
  `DAILY` / `WEEKLY:` / `MONTHLY:`, custom intervals aren't wired yet.
- A multi-day trend chart in the UI (backend endpoint is ready).
- Further "Apple Home"-style visual polish — richer tile treatments,
  drag reordering, per-room grouping — happy to keep iterating on
  this in passes if you point out what feels closest/furthest from
  the mark.
