import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { HttpError } from "@/lib/http/http-error";
import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import { ProjectService } from "@/modules/projects/project.service";
import { UserService } from "@/modules/users/user.service";

import { ProjectHub } from "./project-hub";

const projectService = new ProjectService();
const userService = new UserService();

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("projects:view");
  const canManageProjects = hasPermission(session.role, "projects:manage");
  const canManageOps = hasPermission(session.role, "ops:manage");
  const canViewCosts = hasPermission(session.role, "costs:view");
  const canManageCosts = hasPermission(session.role, "costs:manage");
  const { id } = await params;
  const workDate = todayDate();

  let project;
  try {
    project = await projectService.getById(session.factoryId, id, workDate);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const [assignees, factoryUsers] = await Promise.all([
    canManageProjects
      ? userService.listAssignable(session.factoryId)
      : Promise.resolve([]),
    db.user.findMany({
      where: {
        factoryId: session.factoryId,
        status: { in: ["ACTIVE", "INVITED"] },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
  ]);

  return (
    <ProjectHub
      project={project}
      assignees={assignees.map((a) => ({
        id: a.id,
        displayName: a.displayName,
        role: a.role,
      }))}
      factoryUsers={factoryUsers.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        displayName: `${u.firstName} ${u.lastName}`.trim(),
      }))}
      currentUserId={session.userId}
      workDate={workDate}
      canManageProjects={canManageProjects}
      canManageOps={canManageOps}
      canViewCosts={canViewCosts}
      canManageCosts={canManageCosts}
    />
  );
}
