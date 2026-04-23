"use client";

import { useActionState } from "react";

import { createProjectTaskAction } from "./actions";

const initialProjectDetailActionState = {
  error: null,
  message: null,
};

export function CreateProjectTaskForm({
  projectId,
  assignees,
}: {
  projectId: string;
  assignees: { id: string; displayName: string; role: string }[];
}) {
  const [state, formAction, pending] = useActionState(
    createProjectTaskAction,
    initialProjectDetailActionState
  );

  return (
    <form action={formAction} className="panel space-y-4">
      <input name="projectId" type="hidden" value={projectId} />

      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          New task
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Add project task</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="title">
            Task title
          </label>
          <input className="input-field" id="title" name="title" required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="priority">
            Priority
          </label>
          <select className="input-field" defaultValue="MEDIUM" id="priority" name="priority">
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="assignedToUserId">
            Assignee
          </label>
          <select className="input-field" defaultValue="" id="assignedToUserId" name="assignedToUserId">
            <option value="">Unassigned</option>
            {assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.displayName} · {assignee.role}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="dueDate">
            Due date
          </label>
          <input className="input-field" id="dueDate" name="dueDate" type="date" />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="description">
          Description
        </label>
        <textarea className="input-field min-h-24" id="description" name="description" />
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-3 text-sm">
        <input name="requiresApproval" type="checkbox" />
        This task must be approved before it becomes done.
      </label>

      {state.error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.message && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      <button className="button-primary disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Creating..." : "Create task"}
      </button>
    </form>
  );
}
