# Feature Plan & Direction — Dream 1

> Last updated: April 28, 2026

## Goal

Dream 1 is a **simple project management tool for a factory** — coherent, focused, and built to solve two real problems:

1. **Lost tasks** — information that slips through WhatsApp or verbal memory.
2. **Scattered team** — no clarity on "what are we working on today?" or "where did we leave off?".

The system is **not** for employee monitoring or attendance/timekeeping. It is for managing projects and the things tied to them, in an organized, simple way.

---

## Three Audiences

| Audience | Surface | Purpose |
|---|---|---|
| Owner / Manager | Desktop (`/app/ops` + `/app/projects/[id]`) | Planning, approvals, full overview |
| Supervisor / Production floor | Fixed display (`/floor`) | Visual reminder of today's work — no interaction |
| Worker | Mobile (`/worker` — exists) | "What's my next task?" — minimal |

---

## Agreed Features

### 1. Unified Visual Foundation

A consistent color system across all enums (orders, projects, tasks, queue):

| State | Color | Meaning |
|---|---|---|
| Draft / Backlog / Planning | Calm gray | No attention needed |
| Planned / Approved / Ready | Blue | Ready to start |
| In Progress | Animated teal/green | Working now |
| Waiting Approval / Quality Check | Amber | Action required |
| Blocked / On Hold | Red | Problem, immediate attention |
| Completed / Delivered | Deep green | Success |
| Cancelled | Faded gray + strikethrough | Cancelled |

**Priority:** a small dot beside the title — gray (low) / none (medium) / amber (high) / pulsing red (urgent).

**Core component library:** `<StatusPill>`, `<PriorityDot>`, `<MetricCard>`, `<TaskCard>`, `<ProjectCard>`, `<EmptyState>`, `<ConfirmDialog>`, `<Toast>`, `<BottomSheet>`. Used across every page so the system feels unified.

**Standard page header pattern:** small caption + large title + description + action buttons.

**Toast notifications** after every action ("✓ Cost saved", "✓ Task moved to today").

**Skeleton loaders** instead of empty pages while loading.

**Breadcrumbs** on subpages.

---

### 2. Factory Floor Screen `/floor` (new)

Simple kiosk for the fixed display in the production area:

- Full-screen mode, auto-refresh every 15–30 seconds
- Large fonts, readable from 5+ meters away, high-contrast colors
- **Zero interaction** — display only
- Fixed three-column layout:
  - Left: active projects rail
  - Center: today's queue — each task a large card
  - Right: team status + alerts
- 4 large numbers at the top: completed today / in progress / blocked / remaining
- Use `clamp()` for fonts to fit any screen size

---

### 3. Polishing the Operations Workspace `/app/ops` (the main page)

This is the daily control center — the core improvements:

**Clean Kanban replacing the complex widget builder:** drag-and-drop between columns `Backlog → Planned Today → In Progress → Waiting Approval → Done`. (The enum already exists in `ProjectTaskStatus`.)

**Quick note field** always visible at the bottom of each task card. Press Enter to save instantly, with automatic signature (name + timestamp).

**Visible buttons on the card:**
- ✓ Approve and ✕ Reject (for permitted roles) — single click, no modal
- Large "Done" button on tasks in `IN_PROGRESS`

**Right-click context menu** on the card: move to today / move to tomorrow / assign to / change status.

**Keyboard shortcuts:** `J/K` to navigate, `T` to move to today, `D` to mark done.

**Cmd+K universal search:** from any page, hit `⌘K`, type a project / task / customer / order name → jump directly.

**Universal "Quick Add" `+` button:** modal asks: task? cost? project? note? Reduces friction.

**Stale-task indicator (anti-loss):**
- Task untouched for 3 days → yellow border
- 7 days → red border
- 14 days → automatic notification
- "Last activity" column + filter "show stale only"

Every action is auto-logged in `ProjectActivity` (already exists), and the history is rendered as a clean timeline.

---

### 4. The Project Hub — `/app/projects/[id]`

Each project gets a single comprehensive page — the "project memory":

**Page header:** code, name, status pill, priority, owner, start and due dates, direct links to the linked `Order` and customer.

**Tabs:**
- **Tasks** (Kanban or list)
- **Financials** (details below)
- **Activity** (timeline from `ProjectActivity`)
- **Files & notes** (attachments)
- **Related** (origin order, customer, original CRM inquiry)

Every other page in the system (orders, customers, CRM, notifications) becomes a **gateway leading to the Hub**.

---

### 5. Financial Tracking

**New `ProjectCost` model** in the schema:
- Amount, currency (default SAR)
- Category: `MATERIAL` / `LABOR` / `SERVICE` / `OVERHEAD` / `OTHER`
- Description, vendor name (optional), receipt photo (optional)
- Date, linked to project, optionally linked to a specific task, who added it

**Financials tab inside the Hub:**
- 4 large numbers: quoted to customer / total costs / expected margin / financial completion %
- Costs table with a clear "+ Add cost" button
- Horizontal bar visualizing the cost split by category
- Automatic red alert if costs exceed the quoted amount

**General `/app/finance` page:**
- Projects ranked by profitability
- Monthly totals for costs and received payments
- Projects over budget
- Export to Excel / PDF

**Permissions:** `costs:view` and `costs:manage` — by default for `OWNER` and `ACCOUNTANT` only. The rest of the team sees the project without the numbers.

Every cost entry is auto-logged in `ProjectActivity`.

---

### 6. Mobile Compatibility

- Genuine responsive layout across every page
- Kanban becomes a single column with horizontal snap-scroll between columns
- Wider cards, larger tap targets
- **Bottom sheet** for details instead of a modal
- Easy "add cost" form from mobile (important for the workshop)
- The `/floor` screen is built for TV by nature, so it doesn't need responsive behavior

---

## Memory Features (4 options — pending choice)

These additions solve the "project memory" problem — information scattered across WhatsApp and verbal memory:

### 6a. Photos & attachments on tasks ⭐ Highest priority
- `attachments` field on `ProjectTask`
- Direct upload from mobile, "📷 Attach" button on the card
- Solves ~40% of team-scatter pain

### 6b. Comments on each task
- Simple `TaskComment` model: text + author + timestamp
- `@` mentions trigger a notification
- Turns a task from a static card into living memory

### 6c. Project decision log
- Small "Decisions" tab in the Hub
- Two-line entry per decision + date + decision maker
- Saves the team from later disputes

### 6d. Customer-facing updates
- "Share with customer" button on a task
- Short Arabic message → appears in `/portal`
- Cuts ~70% of "where are you with my order?" calls

**Recommendation:** start with (6a) photos as the bare minimum, and if priorities allow, add (6b) comments.

---

## Deliberately Excluded

- ❌ Employee monitoring / performance tracking
- ❌ Attendance/timekeeping as a focus (the model exists but isn't the development focus)
- ❌ Voice notes (complicate storage and search)
- ❌ Tags/labels (statuses and priorities are sufficient)
- ❌ Project templates (deferred to a later phase if requested)
- ❌ Standalone calendar page (the existing widget is enough for now)
- ❌ Task dependencies (deferred)

---

## Proposed Implementation Order

| Phase | Duration | Output |
|---|---|---|
| 1. Visual foundation (colors + components + tokens) | 2 days | Unblocks everything that follows |
| 2. Factory floor `/floor` | 2 days | Fast visible impact |
| 3. Polish `/app/ops` (Kanban + notes + approvals + Cmd+K + stale) | 3–4 days | The main page |
| 4. The Project Hub | 2–3 days | Unified project page |
| 5. Financials (model + tab + `/app/finance`) | 3–4 days | Financial tracking |
| 6. Selected memory features | 1–3 days (depends on choice) | Per selection |
| 7. Mobile compatibility | 2 days | Across all pages |

**Total:** 14–18 working days for a complete, coherent system.

---

## Technical Notes

- The current data model is solid: `Project → ProjectTask → WorkQueueItem` with `position`, `approvalStatus`, `ProjectActivity`
- The `ProjectCost` migration is small and compatible with the existing schema
- The stack is modern (Next 16, React 19, Prisma 7, Tailwind 4) — we'll avoid heavy extra libraries
- The `ops-widgets.css` file (1,418 lines) will be split into Tailwind utility-first components, with `@apply` reserved for the few repeated patterns
