import Link from "next/link";

import { requirePermission } from "@/modules/auth/guards";
import { AttendanceService } from "@/modules/attendance/attendance.service";
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_TRANSITIONS,
} from "@/modules/production/assignment-status";
import { AssignmentService } from "@/modules/production/assignment.service";

import { AssignmentStatusForm } from "./assignment-status-form";
import { AttendanceForm } from "./attendance-form";

const attendanceService = new AttendanceService();
const assignmentService = new AssignmentService();

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function WorkerEntryPage() {
  const session = await requirePermission("production:view");
  const [attendance, assignments] = await Promise.all([
    attendanceService.getToday(session.factoryId, session.userId),
    assignmentService.listForWorker(session.factoryId, session.userId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Worker workspace
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              My production day
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
              This workspace is now backed by real attendance records and real
              assignments tied to the signed-in user.
            </p>
          </div>
          <Link className="button-secondary" href="/app">
            Back to dashboard
          </Link>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <article className="panel">
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            Attendance today
          </p>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
              <p className="text-sm text-[var(--muted-foreground)]">Clocked in</p>
              <p className="mt-2 text-xl font-semibold">
                {formatDate(attendance?.clockInAt ?? null)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
              <p className="text-sm text-[var(--muted-foreground)]">Clocked out</p>
              <p className="mt-2 text-xl font-semibold">
                {formatDate(attendance?.clockOutAt ?? null)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
              <p className="text-sm font-medium">Start shift</p>
              <div className="mt-3">
                <AttendanceForm mode="in" />
              </div>
            </div>
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
              <p className="text-sm font-medium">End shift</p>
              <div className="mt-3">
                <AttendanceForm mode="out" />
              </div>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                My assignments
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                {assignments.length} assignment{assignments.length === 1 ? "" : "s"}
              </h2>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {assignments.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">
                No assignments are currently linked to your account.
              </p>
            ) : (
              assignments.map((assignment) => {
                const allowedStatuses =
                  ASSIGNMENT_STATUS_TRANSITIONS[assignment.status];

                return (
                  <div
                    key={assignment.id}
                    className="rounded-3xl border border-[var(--border)] bg-[var(--panel-strong)] p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-[var(--muted-foreground)]">
                          {assignment.order.code} · {assignment.order.customerName}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold">
                          {assignment.station}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                          {assignment.order.title}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 text-sm text-[var(--muted-foreground)] md:grid-cols-2">
                      <p>Scheduled: {formatDate(assignment.scheduledFor)}</p>
                      <p>Created: {formatDate(assignment.createdAt)}</p>
                    </div>

                    {assignment.notes && (
                      <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                        {assignment.notes}
                      </p>
                    )}

                    <div className="mt-5 border-t border-[var(--border)] pt-5">
                      <AssignmentStatusForm
                        allowedStatuses={allowedStatuses}
                        assignmentId={assignment.id}
                        currentStatus={assignment.status}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
