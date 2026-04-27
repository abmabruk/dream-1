"use client";

import { useState } from "react";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TASK_STATUS_LABELS,
} from "@/modules/projects/project-status";
import { PRIORITY_COLORS, STATUS_COLORS, post, type OpsProjectWorkspace } from "../shared";

export function DetailSheet({
  project,
  onClose,
  canManage,
  onStatusChange,
  onApprove,
  onReject,
  onAddToQueue,
  onRefresh,
}: {
  project: OpsProjectWorkspace;
  onClose: () => void;
  canManage?: boolean;
  onStatusChange?: (queueItemId: string, status: string) => void;
  onApprove?: (taskId: string) => void;
  onReject?: (taskId: string) => void;
  onAddToQueue?: (taskId: string) => void;
  onRefresh?: () => void;
}) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [addingToQueue, setAddingToQueue] = useState<string | null>(null);

  async function handleAddToQueue(taskId: string) {
    if (onAddToQueue) {
      onAddToQueue(taskId);
      return;
    }
    setAddingToQueue(taskId);
    try {
      await post("/api/v1/ops/queue", {
        taskId,
        workDate: new Date().toISOString().slice(0, 10),
      });
      onRefresh?.();
    } catch {
      // parent handles
    } finally {
      setAddingToQueue(null);
    }
  }

  return (
    <div className="gc-sheet-overlay" onClick={onClose}>
      <div className="gc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="gc-sheet-header">
          <div>
            <span className="gc-sheet-code">{project.orderCode || project.code}</span>
            <h2 className="gc-sheet-title">{project.name}</h2>
          </div>
          <button className="gc-widget-btn" onClick={onClose} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="gc-sheet-body">
          <div className="gc-sheet-field">
            <span className="gc-sheet-label">الحالة</span>
            <span className="gc-sheet-value">{PROJECT_STATUS_LABELS[project.status]}</span>
          </div>
          <div className="gc-sheet-field">
            <span className="gc-sheet-label">الأولوية</span>
            <span className="gc-sheet-value" style={{ color: PRIORITY_COLORS[project.priority] }}>
              {PROJECT_PRIORITY_LABELS[project.priority]}
            </span>
          </div>
          <div className="gc-sheet-field">
            <span className="gc-sheet-label">المالك</span>
            <span className="gc-sheet-value">{project.ownerName || "--"}</span>
          </div>
          <div className="gc-sheet-field">
            <span className="gc-sheet-label">تاريخ الاستحقاق</span>
            <span className="gc-sheet-value">{project.dueDate || "--"}</span>
          </div>
          {project.description && (
            <div className="gc-sheet-field">
              <span className="gc-sheet-label">الوصف</span>
              <p className="gc-sheet-value">{project.description}</p>
            </div>
          )}
          {project.notes && (
            <div className="gc-sheet-field">
              <span className="gc-sheet-label">ملاحظات</span>
              <p className="gc-sheet-value">{project.notes}</p>
            </div>
          )}

          <h3 className="gc-sheet-section">المهام ({project.tasks.length})</h3>
          <div className="gc-sheet-tasks">
            {project.tasks.map((task) => {
              const isExpanded = expandedTaskId === task.id;
              const canQueue = ["BACKLOG", "PLANNED_TODAY"].includes(task.status) && !task.todayQueueItem;
              const queueItem = task.todayQueueItem;

              return (
                <div
                  key={task.id}
                  className={isExpanded ? "gc-sheet-task-expanded" : "gc-sheet-task-clickable"}
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                >
                  <div className="gc-sheet-task" style={{ margin: 0 }}>
                    <div
                      className="gc-task-status-dot"
                      style={{ background: STATUS_COLORS[task.status] }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="gc-sheet-task-title">{task.title}</p>
                      <p className="gc-sheet-task-meta">
                        {task.assignedToName || "غير معين"} | {PROJECT_PRIORITY_LABELS[task.priority]} | {PROJECT_TASK_STATUS_LABELS[task.status] || task.status.replace(/_/g, " ")}
                      </p>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ marginTop: "0.35rem", paddingLeft: "1.2rem" }}>
                      {task.description && (
                        <p className="gc-sheet-task-detail">{task.description}</p>
                      )}
                      {task.approvalStatus !== "NOT_REQUIRED" && (
                        <p className="gc-sheet-task-detail">
                          الموافقة: {task.approvalStatus}
                          {task.approvedByName && ` by ${task.approvedByName}`}
                          {task.rejectedReason && ` - ${task.rejectedReason}`}
                        </p>
                      )}
                      {queueItem && (
                        <p className="gc-sheet-task-detail" style={{ color: "#8b5cf6" }}>
                          في طابور اليوم ({queueItem.status.replace(/_/g, " ").toLowerCase()})
                          {queueItem.notes && ` - ${queueItem.notes}`}

                        </p>
                      )}
                      {canManage && (
                        <div className="gc-sheet-task-actions">
                          {/* Queue actions for items in the queue */}
                          {queueItem && queueItem.status === "PLANNED" && onStatusChange && (
                            <button
                              className="gc-action-btn gc-action-start"
                              type="button"
                              onClick={(e) => { e.stopPropagation(); onStatusChange(queueItem.id, "IN_PROGRESS"); }}
                            >
                              ابدأ
                            </button>
                          )}
                          {queueItem && queueItem.status === "IN_PROGRESS" && onStatusChange && (
                            <>
                              <button
                                className="gc-action-btn gc-action-complete"
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onStatusChange(queueItem.id, task.requiresApproval ? "WAITING_APPROVAL" : "DONE"); }}
                              >
                                {task.requiresApproval ? "إرسال" : "أكمل"}
                              </button>
                              <button
                                className="gc-action-btn gc-action-back"
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onStatusChange(queueItem.id, "PLANNED"); }}
                              >
                                رجوع
                              </button>
                            </>
                          )}
                          {queueItem && queueItem.status === "WAITING_APPROVAL" && onApprove && onReject && (
                            <>
                              <button
                                className="gc-action-btn gc-action-complete"
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onApprove(task.id); }}
                              >
                                موافقة
                              </button>
                              <button
                                className="gc-action-btn gc-action-back"
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onReject(task.id); }}
                              >
                                رفض
                              </button>
                            </>
                          )}
                          {/* Add to today's queue */}
                          {canQueue && (
                            <button
                              className="gc-today-btn"
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void handleAddToQueue(task.id); }}
                              disabled={addingToQueue === task.id}
                            >
                              {addingToQueue === task.id ? "..." : "\u2192 اليوم"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
