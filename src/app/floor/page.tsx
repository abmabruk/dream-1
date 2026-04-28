import { requirePermission } from "@/modules/auth/guards";
import { ProjectService } from "@/modules/projects/project.service";
import { UserService } from "@/modules/users/user.service";

import { FloorDisplay } from "./floor-display";

const projectService = new ProjectService();
const userService = new UserService();

// Server-side ISR: revalidate every 20 seconds so the kiosk stays fresh
// even if the client refresh stalls. The client also calls router.refresh()
// on the same cadence — together they keep the screen alive without flicker.
export const revalidate = 20;

export default async function FloorPage() {
  const session = await requirePermission("ops:view");

  const [board, projects, workers] = await Promise.all([
    projectService.getOpsBoard(session.factoryId),
    projectService.listDetailed(session.factoryId),
    userService.listAssignable(session.factoryId),
  ]);

  // Compute the 4 headline metrics from queue items
  const completedToday = board.queue.filter((q) => q.status === "DONE").length;
  const inProgress = board.queue.filter((q) => q.status === "IN_PROGRESS").length;
  const blocked = board.queue.filter((q) => q.status === "BLOCKED").length;
  const remaining = board.queue.filter(
    (q) => q.status === "PLANNED" || q.status === "WAITING_APPROVAL",
  ).length;

  // Derive a per-worker current task lookup from the queue.
  // A worker is "busy" if they own an IN_PROGRESS queue item today;
  // otherwise we still surface their most recent queued task for context.
  const workerCurrent: Record<string, { title: string; status: string } | null> = {};
  for (const w of workers) workerCurrent[w.id] = null;
  for (const item of board.queue) {
    if (!item.assignedToUserId) continue;
    if (item.status === "IN_PROGRESS") {
      workerCurrent[item.assignedToUserId] = {
        title: item.task.title,
        status: item.status,
      };
    }
  }

  // Active projects: status not COMPLETED/CANCELLED. We also enrich with
  // task progress ratios from the detailed list so the rail can show
  // a real per-project progress bar.
  const projectProgressById = new Map<
    string,
    { done: number; total: number; queuedTodayCount: number }
  >();
  for (const p of projects) {
    const total = p.tasks.filter((t) => t.status !== "CANCELLED").length;
    const done = p.tasks.filter((t) => t.status === "DONE").length;
    const queuedTodayCount = p.tasks.filter((t) => t.todayQueueItem).length;
    projectProgressById.set(p.id, { done, total, queuedTodayCount });
  }

  const priorityRank: Record<string, number> = {
    URGENT: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  const activeProjects = projects
    .filter((p) => p.status !== "COMPLETED" && p.status !== "CANCELLED")
    .map((p) => {
      const stats = projectProgressById.get(p.id) ?? {
        done: 0,
        total: 0,
        queuedTodayCount: 0,
      };
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        status: p.status,
        priority: p.priority,
        done: stats.done,
        total: stats.total,
        queuedTodayCount: stats.queuedTodayCount,
        currentStageName: p.currentStageInstance?.name ?? null,
      };
    })
    .sort((a, b) => {
      const pa = priorityRank[a.priority] ?? 9;
      const pb = priorityRank[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return b.queuedTodayCount - a.queuedTodayCount;
    })
    .slice(0, 8);

  // Alerts = blocked queue items + waiting-approval queue items
  const alerts = board.queue
    .filter((q) => q.status === "BLOCKED" || q.status === "WAITING_APPROVAL")
    .map((q) => ({
      id: q.id,
      title: q.task.title,
      projectCode: q.task.projectCode,
      assigneeName: q.assignedToName,
      tone: q.status === "BLOCKED" ? ("blocked" as const) : ("waiting" as const),
      label: q.status === "BLOCKED" ? "متوقف" : "بانتظار الموافقة",
    }));

  // Team rows: id, name, role, current task title or null
  const team = workers.map((w) => ({
    id: w.id,
    displayName: w.displayName,
    role: w.role,
    currentTaskTitle: workerCurrent[w.id]?.title ?? null,
  }));

  return (
    <FloorDisplay
      factoryName={session.factoryName}
      metrics={{ completedToday, inProgress, blocked, remaining }}
      queue={board.queue}
      projects={activeProjects}
      alerts={alerts}
      team={team}
      generatedAtIso={new Date().toISOString()}
    />
  );
}
