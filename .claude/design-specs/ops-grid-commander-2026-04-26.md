---
status: approved
generated_by: ab-ui
date: 2026-04-26
based_on: Approach C (Grid Commander) — approved by user
---

# Design Spec: Operations Workspace — Grid Commander

## Overview
Rebuild the ops workspace (`/app/ops`) as a widget-based dashboard with 7 customizable widgets. The prototype exists in `.worktrees/explore-c` with mock data. This spec defines how to wire it to real APIs, integrate with the rest of the system (orders, projects), and add missing interactions.

## Source Files (Prototype Reference)
- `.worktrees/explore-c/src/app/app/ops/ops-workspace.tsx` — full UI (copy as starting point)
- `.worktrees/explore-c/src/app/app/ops/mock-data.ts` — mock data types/structure (reference for API shapes)
- `.worktrees/explore-c/src/app/globals.css` — `.gc-*` styles (copy the CSS block)

## Architecture: Server → Client Data Flow

The page uses Next.js App Router:
- `page.tsx` = **server component** — fetches all data, passes as props
- `ops-workspace.tsx` = **client component** — renders widgets, handles interactions

### page.tsx should fetch:
```typescript
const [todayBoard, tomorrowBoard, projectList] = await Promise.all([
  projectService.getOpsBoard(factoryId, { date: today }),
  projectService.getOpsBoard(factoryId, { date: tomorrow }),
  projectService.list(factoryId, today),
]);
// Also fetch: workers with task counts, recent activities
const workers = await userService.listWorkers(factoryId);
const activities = await projectService.getRecentActivities(factoryId, 10);
```

### Props to OpsWorkspace:
```typescript
type OpsWorkspaceProps = {
  factoryName: string;
  canManage: boolean;
  canCreateTask: boolean;
  canCreateProject: boolean;
  // Real data
  todayBoard: OpsBoardData;
  tomorrowBoard: OpsBoardData;
  projects: OpsProjectWorkspace[];
  workers: WorkerSummary[];
  activities: ActivityItem[];
};
```

## Widgets — Data Source Mapping

### 1. Today's Queue Widget (طابور اليوم)
**Source:** `todayBoard.queue` from `OpsBoardData`
**Lanes:** PLANNED | IN_PROGRESS/WAITING_APPROVAL | DONE (derived from queue item status)
**Interactions:**
- Drag between lanes → `POST /api/v1/ops/queue/{id}/status` with new status
- Start button → status: IN_PROGRESS
- Complete button → status: DONE (or WAITING_APPROVAL if requiresApproval)
- Back button → status: PLANNED
**Must use:** existing `quickStatus()` and `review()` functions from original ops-workspace.tsx

### 2. Projects Widget (المشاريع)
**Source:** `projects` array (from `projectService.list` + `projectService.getById`)
**Display:** Project code, name, priority badge, status, progress bar (done tasks / total tasks)
**Interactions:**
- Click project → expand to show tasks list inline (or Sheet)
- Click chevron → collapse/expand
- Progress = `tasks.filter(done).length / tasks.length * 100`
**Link to Orders:** Show `orderCode` if project has `orderId` — clicking navigates to `/app/orders`

### 3. Alerts & Approvals Widget (تنبيهات وموافقات)
**Source:** Derived from queue data:
- Approvals: `queue.filter(i => i.status === 'WAITING_APPROVAL')`
- Blocked: `queue.filter(i => i.status === 'BLOCKED')`
- Overdue: tasks with `dueDate < today` and status not DONE
**Interactions:**
- Approve → `POST /api/v1/projects/tasks/{taskId}/review` with decision: "approve"
- Reject → `POST /api/v1/projects/tasks/{taskId}/review` with decision: "reject"
- Must trigger `router.refresh()` after action so all widgets update

### 4. Team Status Widget (حالة الفريق)
**Source:** New — needs `userService.listWorkers(factoryId)` or derive from queue data
**Data needed per worker:**
- Name, role
- Task count (from queue assigned to them)
- Active tasks / Done tasks (from today's queue)
- Availability (from AttendanceRecord — clocked in today = available)
**Implementation:**
- Derive from `todayBoard.queue` by grouping `assignedToUserId`
- Optional: attendance check from existing attendance API
- Show colored dot: green = available, red = busy/blocked tasks, gray = not clocked in

### 5. Quick Notes Widget (ملاحظات سريعة)
**Source:** New — needs storage mechanism
**Options (pick simplest):**
- Option A: Store in `localStorage` per user (no API needed, simplest)
- Option B: Store in a factory-level setting or user preference
**Recommendation:** Start with localStorage. The textarea saves onChange with debounce.
**Key:** Notes content persists across page refreshes.

### 6. Calendar Widget (التقويم)
**Source:** `todayBoard` + `tomorrowBoard` + tasks with `dueDate`
**Display:** Current week (Sun-Thu), each day shows tasks due that day
**Data:** `projects.flatMap(p => p.tasks).filter(t => t.dueDate within this week)`
**Interactions:**
- Click task in calendar → opens task detail Sheet
- Future: drag task to reschedule (changes dueDate)

### 7. Activity Feed Widget (سجل النشاط)
**Source:** New — needs `projectService.getRecentActivities(factoryId, limit)`
**Implementation:** Query `ProjectActivity` table ordered by createdAt DESC, limit 10-20
**Display:** Icon per type + message + actor name + timeAgo
**Types:** PROJECT_CREATED, TASK_CREATED, TASK_UPDATED, TASK_APPROVED, TASK_REJECTED, QUEUE_STATUS_CHANGED

## New APIs / Service Methods Needed

### 1. Worker Summary (for Team Status widget)
```typescript
// In user.repository.ts or derive in page.tsx
async listWorkersWithStats(factoryId: string, date: string): Promise<WorkerSummary[]>
// Returns: { id, name, role, taskCount, activeTasks, doneTasks, clockedIn }
// JOIN users + workQueueItems (for date) + attendanceRecords (for date)
```

### 2. Recent Activities
```typescript
// In project.repository.ts
async getRecentActivities(factoryId: string, limit: number): Promise<ActivityItem[]>
// Query: SELECT from ProjectActivity WHERE factoryId ORDER BY createdAt DESC LIMIT
// Returns: { id, type, message, actorName, createdAt }
```

### 3. Create Project (from ops page)
**Existing:** `POST /api/v1/projects` — may need a new route or reuse
**Schema:** `createProjectSchema` already exists in project.schemas.ts
**UI:** "Add Project" dialog/sheet with: name, priority, orderId (optional), description

## Existing APIs to Reuse (NO changes needed)
| API | Used By Widget | Purpose |
|-----|---------------|---------|
| `POST /api/v1/ops/queue/{id}/status` | Today's Queue | Change task status |
| `POST /api/v1/ops/queue` | Today's Queue | Add task to queue |
| `POST /api/v1/ops/queue/reorder` | Today's Queue | Reorder queue |
| `POST /api/v1/projects/tasks/{id}/review` | Alerts | Approve/Reject |
| `POST /api/v1/projects/{id}/tasks` | Projects | Add task to project |
| `projectService.getOpsBoard()` | Queue, Calendar, Alerts | Board data |
| `projectService.list()` | Projects | Project list |
| `projectService.getById()` | Projects | Project detail |

## Integration with Other Pages

### Orders Page (`/app/orders`)
- Projects linked to orders via `Project.orderId`
- When task status changes in ops → order assignments should reflect
- Project widget shows `orderCode` — clicking navigates to order detail
- Status changes in ops should be visible in order timeline (OrderEvent)

### Projects Page (`/app/projects`)
- Same data source as Projects widget
- Adding project in ops = adding project in projects page
- Task status changes sync automatically (same DB, same service)

### Notifications
- Approval actions should trigger notifications (existing notification system)
- Blocked tasks should appear in notifications for supervisors

## Implementation Steps (for ab-super)

### Step 1: Copy prototype UI to main
- Copy `.gc-*` CSS from explore-c globals.css → main globals.css
- Copy ops-workspace.tsx structure but remove mock imports
- Keep the widget system, layout presets, drag/resize

### Step 2: Wire page.tsx to real data
- Restore the real data fetching from original page.tsx
- Add worker summary and activities fetching
- Pass all data as props to OpsWorkspace
- Transform real data shapes to match what widgets expect

### Step 3: Wire widget interactions to APIs
- Today's Queue: drag between lanes calls status API
- Alerts: approve/reject calls review API
- Projects: expand shows real tasks
- Add Task: calls existing create task API
- All actions → router.refresh() to sync all widgets

### Step 4: Add missing service methods
- `getRecentActivities()` in project.repository.ts
- Worker summary derivation in page.tsx (from queue data + attendance)

### Step 5: Add Project creation
- Add dialog/sheet for creating new project from ops page
- Reuse existing createProjectSchema
- Option to link to existing order

### Step 6: Quick Notes persistence
- localStorage with factory-specific key
- Debounced save on textarea change

### Step 7: Polish & States
- Loading skeletons for each widget
- Empty states with helpful messages
- Error toast on API failures
- Auto-refresh every 30 seconds (existing pattern)
- Mobile: widgets stack in single column

## Design Identity (preserve from prototype)
- Dark background: #1a1a1a
- Widget cards: #222 with #333 borders
- Colored accent strip per widget type
- Teal (#14b8a6) for primary actions
- Amber (#f59e0b) for warnings
- Red (#ef4444) for blocked/danger
- Arabic text support (task names in Arabic)
- Compact data density

## Files to Modify
| File | Action |
|------|--------|
| `src/app/app/ops/ops-workspace.tsx` | Rewrite with Grid Commander UI + real data |
| `src/app/app/ops/page.tsx` | Add workers + activities fetching |
| `src/app/globals.css` | Add `.gc-*` styles |
| `src/modules/projects/project.repository.ts` | Add getRecentActivities() |
| `src/modules/projects/project.service.ts` | Add getRecentActivities() |
| `src/modules/users/user.repository.ts` | Optional: worker stats query |

## Files NOT to Modify
- Schema (prisma/schema.prisma) — no DB changes needed
- Existing API routes — reuse as-is
- Other pages — they share the same data layer so changes sync automatically
