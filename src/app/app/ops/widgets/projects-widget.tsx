"use client";

import { useState } from "react";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/modules/projects/project-status";
import { PRIORITY_COLORS, STATUS_COLORS, post, type OpsProjectWorkspace } from "../shared";

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
      {projects.map((proj) => {
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
                  <span className="gc-project-code">{proj.orderCode || proj.code}</span>
                  <span
                    className="gc-priority-badge"
                    style={{ background: `${PRIORITY_COLORS[proj.priority]}22`, color: PRIORITY_COLORS[proj.priority] }}
                  >
                    {PROJECT_PRIORITY_LABELS[proj.priority]}
                  </span>
                  <span className="gc-project-status">{PROJECT_STATUS_LABELS[proj.status]}</span>
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
                <p className="gc-project-name">{proj.name}</p>
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
                    <div
                      key={task.id}
                      className="gc-project-task-row"
                      onClick={() => onSelectProject(proj)}
                    >
                      <div
                        className="gc-task-status-dot"
                        style={{ background: STATUS_COLORS[task.status] }}
                      />
                      <span className="gc-task-title-sm">{task.title}</span>
                      <span className="gc-task-assignee-sm">{task.assignedToName || "--"}</span>
                      {canManage && canQueue && (
                        <button
                          className="gc-today-btn"
                          type="button"
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
