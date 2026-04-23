import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import type {
  ProjectDetail,
  ProjectListItem,
} from "@/modules/projects/project.schemas";
import { ProjectService } from "@/modules/projects/project.service";

import { OpsWorkspace } from "./ops-workspace";

const projectService = new ProjectService();

function boardDate(offset = 0) {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return value.toISOString().slice(0, 10);
}

type OpsProjectWorkspace = ProjectDetail & Pick<
  ProjectListItem,
  "openTaskCount" | "queuedTodayCount" | "waitingApprovalCount"
>;

export default async function OpsPage() {
  const session = await requirePermission("ops:view");
  const canManage = hasPermission(session.role, "ops:manage");
  const today = boardDate(0);
  const tomorrow = boardDate(1);

  const [todayBoard, tomorrowBoard, projectList] = await Promise.all([
    projectService.getOpsBoard(session.factoryId, { date: today }),
    projectService.getOpsBoard(session.factoryId, { date: tomorrow }),
    projectService.list(session.factoryId, today),
  ]);

  const visibleProjects = projectList
    .filter((project) => !["COMPLETED", "CANCELLED"].includes(project.status))
    .slice(0, 5);

  const projectDetails = await Promise.all(
    visibleProjects.map((project) =>
      projectService.getById(session.factoryId, project.id, today)
    )
  );

  const projects: OpsProjectWorkspace[] = projectDetails.map((detail) => {
    const summary = visibleProjects.find((project) => project.id === detail.id);

    return {
      ...detail,
      openTaskCount: summary?.openTaskCount ?? 0,
      queuedTodayCount: summary?.queuedTodayCount ?? 0,
      waitingApprovalCount: summary?.waitingApprovalCount ?? 0,
    };
  });

  return (
    <OpsWorkspace
      canManage={canManage}
      factoryName={session.factoryName}
      projects={projects}
      todayBoard={todayBoard}
      tomorrowBoard={tomorrowBoard}
    />
  );
}
