import Link from "next/link";

import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TASK_STATUS_LABELS,
  TASK_APPROVAL_STATUS_LABELS,
  WORK_QUEUE_STATUS_LABELS,
} from "@/modules/projects/project-status";
import { ProjectService } from "@/modules/projects/project.service";
import { UserService } from "@/modules/users/user.service";

import { addTaskToTodayAction } from "./actions";
import { CreateProjectTaskForm } from "./create-project-task-form";

const projectService = new ProjectService();
const userService = new UserService();

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("projects:view");
  const canManageProjects = hasPermission(session.role, "projects:manage");
  const canManageOps = hasPermission(session.role, "ops:manage");
  const { id } = await params;
  const workDate = todayDate();

  const [project, assignees] = await Promise.all([
    projectService.getById(session.factoryId, id, workDate),
    canManageProjects ? userService.listAssignable(session.factoryId) : Promise.resolve([]),
  ]);

  return (
    <main className="space-y-6">
      <section className="panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              {project.code}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{project.name}</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
              {project.description || "No description has been set yet for this project."}
            </p>
          </div>
          <Link className="button-secondary" href="/app/ops">
            Open today ops
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <article className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
            <p className="text-sm text-[var(--muted-foreground)]">Status</p>
            <h2 className="mt-2 text-xl font-semibold">{PROJECT_STATUS_LABELS[project.status]}</h2>
          </article>
          <article className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
            <p className="text-sm text-[var(--muted-foreground)]">Priority</p>
            <h2 className="mt-2 text-xl font-semibold">
              {PROJECT_PRIORITY_LABELS[project.priority]}
            </h2>
          </article>
          <article className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
            <p className="text-sm text-[var(--muted-foreground)]">Owner</p>
            <h2 className="mt-2 text-xl font-semibold">{project.ownerName || "Unassigned"}</h2>
          </article>
          <article className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
            <p className="text-sm text-[var(--muted-foreground)]">Linked order</p>
            <h2 className="mt-2 text-xl font-semibold">{project.orderCode || "No order"}</h2>
          </article>
          <article className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
            <p className="text-sm text-[var(--muted-foreground)]">Due</p>
            <h2 className="mt-2 text-xl font-semibold">{formatDate(project.dueDate)}</h2>
          </article>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
        <article className="space-y-6">
          <section className="panel">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <h2 className="text-2xl font-semibold">Tasks</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {project.tasks.length} tasks in this project
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {project.tasks.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">
                  No tasks yet. Start by adding the first operational step for this project.
                </p>
              ) : (
                project.tasks.map((task) => (
                  <article
                    key={task.id}
                    className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold">{task.title}</h3>
                        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                          {task.description || "No task description yet."}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p>{PROJECT_TASK_STATUS_LABELS[task.status]}</p>
                        <p className="mt-1 text-[var(--muted-foreground)]">
                          {PROJECT_PRIORITY_LABELS[task.priority]}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-[var(--muted-foreground)] md:grid-cols-2">
                      <p>Assignee: {task.assignedToName || "Unassigned"}</p>
                      <p>Due: {formatDate(task.dueDate)}</p>
                      <p>
                        Approval:{" "}
                        {task.requiresApproval
                          ? TASK_APPROVAL_STATUS_LABELS[task.approvalStatus]
                          : "Not required"}
                      </p>
                      <p>Completed: {formatDate(task.completedAt)}</p>
                    </div>

                    {task.rejectedReason && (
                      <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Rejected reason: {task.rejectedReason}
                      </p>
                    )}

                    {task.todayQueueItem ? (
                      <div className="mt-4 rounded-2xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm">
                        <p className="font-medium">
                          In today queue at position {task.todayQueueItem.position}
                        </p>
                        <p className="mt-1 text-[var(--muted-foreground)]">
                          Status: {WORK_QUEUE_STATUS_LABELS[task.todayQueueItem.status]}
                          {task.todayQueueItem.assignedToName
                            ? ` · ${task.todayQueueItem.assignedToName}`
                            : ""}
                        </p>
                      </div>
                    ) : canManageOps && !["DONE", "CANCELLED"].includes(task.status) ? (
                      <form action={addTaskToTodayAction} className="mt-4 flex flex-wrap gap-3">
                        <input name="projectId" type="hidden" value={project.id} />
                        <input name="taskId" type="hidden" value={task.id} />
                        <input name="workDate" type="hidden" value={workDate} />
                        <input name="assignedToUserId" type="hidden" value={task.assignedToUserId ?? ""} />
                        <button className="button-secondary" type="submit">
                          Add to today
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <h2 className="text-2xl font-semibold">Activity</h2>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  Latest project movements and approvals
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {project.activities.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No activity yet.</p>
              ) : (
                project.activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4"
                  >
                    <p className="font-medium">{activity.message}</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {activity.actorName || "System"} · {formatDate(activity.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </article>

        {canManageProjects ? (
          <CreateProjectTaskForm
            assignees={assignees.map((assignee) => ({
              id: assignee.id,
              displayName: assignee.displayName,
              role: assignee.role,
            }))}
            projectId={project.id}
          />
        ) : (
          <section className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Access
            </p>
            <h2 className="mt-2 text-2xl font-semibold">View-only access</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
              You can monitor task flow here, but task planning changes are limited to
              operations leads.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
