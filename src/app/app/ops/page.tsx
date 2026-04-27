import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import { ProjectService } from "@/modules/projects/project.service";
import { UserService } from "@/modules/users/user.service";

import { OpsWorkspace } from "./ops-workspace";

const projectService = new ProjectService();
const userService = new UserService();

export default async function OpsPage() {
  const session = await requirePermission("ops:view");
  const canManage = hasPermission(session.role, "ops:manage");

  const [board, projects, workers] = await Promise.all([
    projectService.getOpsBoard(session.factoryId),
    projectService.listDetailed(session.factoryId),
    userService.listAssignable(session.factoryId),
  ]);

  const opsProjects = projects.map((p) => ({
    ...p,
    openTaskCount: p.tasks.filter((t) => !["DONE", "CANCELLED"].includes(t.status)).length,
    queuedTodayCount: p.tasks.filter((t) => t.todayQueueItem).length,
    waitingApprovalCount: p.tasks.filter((t) => t.approvalStatus === "PENDING").length,
  }));

  const activities = projects
    .flatMap((p) => p.activities)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  return (
    <OpsWorkspace
      factoryName={session.factoryName}
      canManage={canManage}
      initialBoard={board}
      initialProjects={opsProjects}
      workers={workers.map((w) => ({ id: w.id, displayName: w.displayName, role: w.role }))}
      initialActivities={activities}
    />
  );
}
