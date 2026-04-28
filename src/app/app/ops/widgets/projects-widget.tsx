"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/modules/projects/project-status";
import { PRIORITY_COLORS, post, type OpsProjectWorkspace } from "../shared";
import { TaskCard, useToast } from "@/components/ui";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

function InlineAddTaskForm({
  projectId,
  onDone,
  onCancel,
}: {
  projectId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) {
      setError("3 أحرف على الأقل");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await post(`/api/v1/projects/${projectId}/tasks`, { title: title.trim(), priority });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشلت العملية.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="gc-inline-form">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title..."
        autoFocus
      />
      <select value={priority} onChange={(e) => setPriority(e.target.value)}>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>{PROJECT_PRIORITY_LABELS[p]}</option>
        ))}
      </select>
      <button type="submit" className="gc-inline-submit" disabled={saving}>
        {saving ? "..." : "إضافة"}
      </button>
      <button type="button" className="gc-inline-cancel" onClick={onCancel}>
        ×
      </button>
      {error && <span style={{ color: "#ef4444", fontSize: "0.65rem" }}>{error}</span>}
    </form>
  );
}

export function ProjectsWidget({
  projects,
  onSelectProject,
  canManage,
  onRefresh,
}: {
  projects: OpsProjectWorkspace[];
  onSelectProject: (p: OpsProjectWorkspace) => void;
  canManage?: boolean;
  onRefresh?: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingTaskForId, setAddingTaskForId] = useState<string | null>(null);
  const [addingToQueue, setAddingToQueue] = useState<string | null>(null);
  const { toast } = useToast();

  // Reorder projects within the widget — uses the same persistent sort order
  // as /app/projects (POST /api/v1/projects/reorder).
  async function handleMoveProject(projectId: string, direction: "up" | "down") {
    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx < 0) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= projects.length) return;
    const next = [...projects];
    [next[idx], next[target]] = [next[target], next[idx]];
    try {
      const res = await fetch("/api/v1/projects/reorder", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(direction === "up" ? "✓ تم النقل للأعلى" : "✓ تم النقل للأسفل", "success");
      onRefresh?.();
    } catch {
      toast("تعذّر النقل", "error");
    }
  }

  async function handleAddToQueue(taskId: string) {
    setAddingToQueue(taskId);
    try {
      await post("/api/v1/ops/queue", {
        taskId,
        workDate: new Date().toISOString().slice(0, 10),
      });
      onRefresh?.();
    } catch {
      // silently fail — the parent will show error via its own mechanism
    } finally {
      setAddingToQueue(null);
    }
  }

  if (projects.length === 0) {
    return <p className="gc-empty">لا توجد مشاريع نشطة</p>;
  }

  return (
    <div className="gc-projects-list">
      {projects.map((proj, projIdx) => {
        const isExpanded = expandedId === proj.id;
        const tasksDone = proj.tasks.filter((t) => t.status === "DONE").length;
        const totalTasks = proj.tasks.length;
        const pct = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0;

        return (
          <div key={proj.id} className="gc-project-item">
            <div
              className="gc-project-header"
              onClick={() => setExpandedId(isExpanded ? null : proj.id)}
            >
              <div className="gc-project-info">
                <div className="gc-project-top-row">
                  <Link
                    href={`/app/projects/${proj.id}`}
                    className="gc-project-code hover:underline"
                    onClick={(e) => e.stopPropagation()}
                    title="فتح صفحة المشروع"
                  >
                    {proj.orderCode || proj.code}
                  </Link>
                  <span
                    className="gc-priority-badge"
                    style={{ background: `${PRIORITY_COLORS[proj.priority]}22`, color: PRIORITY_COLORS[proj.priority] }}
                  >
                    {PROJECT_PRIORITY_LABELS[proj.priority]}
                  </span>
                  <span className="gc-project-status">{PROJECT_STATUS_LABELS[proj.status]}</span>
                  {canManage && projects.length > 1 && (
                    <span className="ms-auto inline-flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="نقل المشروع للأعلى"
                        title="نقل للأعلى"
                        disabled={projIdx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleMoveProject(proj.id, "up");
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[0.7rem] disabled:opacity-30 hover:bg-[var(--surface-subtle)]"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="نقل المشروع للأسفل"
                        title="نقل للأسفل"
                        disabled={projIdx === projects.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleMoveProject(proj.id, "down");
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[0.7rem] disabled:opacity-30 hover:bg-[var(--surface-subtle)]"
                      >
                        ↓
                      </button>
                    </span>
                  )}
                  {canManage && (
                    <button
                      className="gc-add-task-btn"
                      type="button"
                      title="إضافة مهمة"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedId(proj.id);
                        setAddingTaskForId(addingTaskForId === proj.id ? null : proj.id);
                      }}
                    >
                      +
                    </button>
                  )}
                </div>
                <Link
                  href={`/app/projects/${proj.id}`}
                  className="gc-project-name hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {proj.name}
                </Link>
                <div className="gc-progress-row">
                  <div className="gc-progress-bar">
                    <div
                      className="gc-progress-fill"
                      style={{ width: `${pct}%`, background: pct === 100 ? "#10b981" : "#14b8a6" }}
                    />
                  </div>
                  <span className="gc-progress-text">{pct}%</span>
                </div>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="gc-chevron"
                style={{ transform: isExpanded ? "rotate(180deg)" : "none" }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {isExpanded && (
              <div className="gc-project-tasks">
                {addingTaskForId === proj.id && (
                  <InlineAddTaskForm
                    projectId={proj.id}
                    onDone={() => {
                      setAddingTaskForId(null);
                      onRefresh?.();
                    }}
                    onCancel={() => setAddingTaskForId(null)}
                  />
                )}
                {proj.tasks.map((task) => {
                  const canQueue = ["BACKLOG", "PLANNED_TODAY"].includes(task.status) && !task.todayQueueItem;
                  return (
                    <TaskCard
                      key={task.id}
                      id={task.id}
                      title={task.title}
                      status={task.status}
                      priority={task.priority}
                      projectCode={proj.orderCode || proj.code}
                      assigneeName={task.assignedToName}
                      dueDate={task.dueDate}
                      lastActivityAt={task.updatedAt}
                      onClick={() => onSelectProject(proj)}
                    >
                      <div className="flex items-center gap-2 flex-wrap text-[0.65rem]">
                        {canManage && canQueue && (
                          <button
                            type="button"
                            className="gc-today-btn"
                            title="إضافة إلى طابور اليوم"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleAddToQueue(task.id);
                            }}
                            disabled={addingToQueue === task.id}
                          >
                            {addingToQueue === task.id ? "..." : "\u2192 اليوم"}
                          </button>
                        )}
                        {task.todayQueueItem && (
                          <span style={{ fontSize: "0.6rem", color: "#8b5cf6", fontWeight: 600 }}>في الطابور</span>
                        )}
                      </div>
                    </TaskCard>
                  );
                })}
                {proj.tasks.length === 0 && <p className="gc-empty">لا توجد مهام</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
