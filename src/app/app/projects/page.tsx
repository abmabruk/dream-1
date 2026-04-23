import Link from "next/link";

import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import { OrderService } from "@/modules/orders/order.service";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/modules/projects/project-status";
import { ProjectService } from "@/modules/projects/project.service";
import { UserService } from "@/modules/users/user.service";

import { CreateProjectForm } from "./create-project-form";

const projectService = new ProjectService();
const orderService = new OrderService();
const userService = new UserService();

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function ProjectsPage() {
  const session = await requirePermission("projects:view");
  const canManage = hasPermission(session.role, "projects:manage");
  const workDate = todayDate();

  const [projects, orders, users] = await Promise.all([
    projectService.list(session.factoryId, workDate),
    canManage ? orderService.list(session.factoryId) : Promise.resolve([]),
    canManage ? userService.list(session.factoryId) : Promise.resolve([]),
  ]);

  const owners = users.filter((user) =>
    ["OWNER", "FACTORY_MANAGER", "SUPERVISOR", "SALES_MANAGER"].includes(user.role)
  );

  const activeProjects = projects.filter(
    (project) => !["COMPLETED", "CANCELLED"].includes(project.status)
  );

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Projects
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Internal project control
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          Keep projects as clean containers for work. The daily ops board handles what must be
          executed today, while this page keeps the full picture for each project.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">All projects</p>
          <h2 className="mt-2 text-3xl font-semibold">{projects.length}</h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Active</p>
          <h2 className="mt-2 text-3xl font-semibold">{activeProjects.length}</h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Waiting approval</p>
          <h2 className="mt-2 text-3xl font-semibold">
            {projects.reduce((sum, project) => sum + project.waitingApprovalCount, 0)}
          </h2>
        </article>
        <article className="panel">
          <p className="text-sm text-[var(--muted-foreground)]">Queued today</p>
          <h2 className="mt-2 text-3xl font-semibold">
            {projects.reduce((sum, project) => sum + project.queuedTodayCount, 0)}
          </h2>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="panel overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-2xl font-semibold">Projects list</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {projects.length} projects tracked across the factory
              </p>
            </div>
            <Link className="button-secondary" href="/app/ops">
              Open today ops
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className="py-10 text-sm text-[var(--muted-foreground)]">
              No projects yet. Create the first one and start adding internal tasks.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[var(--muted-foreground)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="py-3 pr-4 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Open tasks</th>
                    <th className="px-4 py-3 font-medium">Today</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="py-4 pr-4">
                        <Link className="font-medium hover:underline" href={`/app/projects/${project.id}`}>
                          {project.code} · {project.name}
                        </Link>
                        {project.orderCode && (
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            Linked to {project.orderCode}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">{PROJECT_STATUS_LABELS[project.status]}</td>
                      <td className="px-4 py-4">{PROJECT_PRIORITY_LABELS[project.priority]}</td>
                      <td className="px-4 py-4">{project.ownerName || "Unassigned"}</td>
                      <td className="px-4 py-4">{project.openTaskCount}</td>
                      <td className="px-4 py-4">{project.queuedTodayCount}</td>
                      <td className="px-4 py-4">{formatDate(project.dueDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {canManage ? (
          <CreateProjectForm
            orders={orders.map((order) => ({
              id: order.id,
              code: order.code,
              title: order.title,
            }))}
            owners={owners.map((user) => ({
              id: user.id,
              displayName: user.displayName,
              role: user.role,
            }))}
          />
        ) : (
          <section className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Access
            </p>
            <h2 className="mt-2 text-2xl font-semibold">View-only access</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
              Your role can monitor projects, but project creation and planning are handled by
              operations leads.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
