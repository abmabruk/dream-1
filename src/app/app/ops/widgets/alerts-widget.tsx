"use client";

import { useMemo } from "react";
import type { OpsBoardData } from "@/modules/projects/project.schemas";

type AlertItem = {
  id: string;
  type: "approval" | "blocked" | "overdue";
  title: string;
  description: string;
  taskId: string;
  projectCode: string;
  severity: "warning" | "danger" | "info";
};

export function AlertsWidget({
  todayBoard,
  canManage,
  onApprove,
  onReject,
}: {
  todayBoard: OpsBoardData;
  canManage: boolean;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
}) {
  const alerts = useMemo<AlertItem[]>(() => {
    const result: AlertItem[] = [];

    todayBoard.queue
      .filter((i) => i.status === "WAITING_APPROVAL")
      .forEach((i) => {
        result.push({
          id: `approval-${i.id}`,
          type: "approval",
          title: "بحاجة إلى موافقة",
          description: `${i.task.title} في انتظار الموافقة`,
          taskId: i.task.id,
          projectCode: i.task.projectCode,
          severity: "warning",
        });
      });

    todayBoard.queue
      .filter((i) => i.status === "BLOCKED")
      .forEach((i) => {
        result.push({
          id: `blocked-${i.id}`,
          type: "blocked",
          title: "مهمة محظورة",
          description: `${i.task.title} محظورة`,
          taskId: i.task.id,
          projectCode: i.task.projectCode,
          severity: "danger",
        });
      });

    todayBoard.forgottenTasks.forEach((t) => {
      result.push({
        id: `overdue-${t.id}`,
        type: "overdue",
        title: "مهمة متأخرة",
        description: `${t.title} - تجاوزت تاريخ الاستحقاق`,
        taskId: t.id,
        projectCode: t.projectCode,
        severity: "danger",
      });
    });

    return result;
  }, [todayBoard]);

  const severityColors = {
    warning: { bg: "#f59e0b18", border: "#f59e0b44", text: "#f59e0b" },
    danger: { bg: "#ef444418", border: "#ef444444", text: "#ef4444" },
    info: { bg: "#3b82f618", border: "#3b82f644", text: "#3b82f6" },
  };

  return (
    <div className="gc-alerts-list">
      {alerts.length === 0 && <p className="gc-empty">لا توجد تنبيهات</p>}
      {alerts.map((alert) => {
        const colors = severityColors[alert.severity];
        return (
          <div
            key={alert.id}
            className="gc-alert-item"
            style={{ background: colors.bg, borderColor: colors.border }}
          >
            <div className="gc-alert-icon">
              {alert.type === "approval" && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                </svg>
              )}
              {alert.type === "blocked" && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              )}
              {alert.type === "overdue" && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              )}
            </div>
            <div className="gc-alert-body">
              <p className="gc-alert-title" style={{ color: colors.text }}>{alert.title}</p>
              <p className="gc-alert-desc">{alert.description}</p>
              <span className="gc-alert-project">{alert.projectCode}</span>
            </div>
            {alert.type === "approval" && canManage && (
              <div className="gc-alert-actions">
                <button
                  className="gc-action-btn gc-action-complete"
                  onClick={() => onApprove(alert.taskId)}
                  type="button"
                >
                  موافقة
                </button>
                <button
                  className="gc-action-btn gc-action-back"
                  onClick={() => onReject(alert.taskId)}
                  type="button"
                >
                  رفض
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
