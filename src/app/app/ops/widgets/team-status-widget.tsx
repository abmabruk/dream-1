"use client";

import { useMemo } from "react";
import type { OpsBoardData } from "@/modules/projects/project.schemas";

export function TeamStatusWidget({
  todayBoard,
  workers,
}: {
  todayBoard: OpsBoardData;
  workers: { id: string; displayName: string; role: string }[];
}) {
  const teamData = useMemo(() => {
    const workerMap = new Map<string, { name: string; role: string; total: number; active: number; done: number; hasActiveTasks: boolean }>();

    workers.forEach((w) => {
      workerMap.set(w.id, { name: w.displayName, role: w.role, total: 0, active: 0, done: 0, hasActiveTasks: false });
    });

    todayBoard.queue.forEach((item) => {
      if (!item.assignedToUserId) return;
      const existing = workerMap.get(item.assignedToUserId);
      if (existing) {
        existing.total++;
        if (item.status === "DONE") existing.done++;
        if (item.status === "IN_PROGRESS") { existing.active++; existing.hasActiveTasks = true; }
      } else {
        workerMap.set(item.assignedToUserId, {
          name: item.assignedToName || "Unknown",
          role: "",
          total: 1,
          active: item.status === "IN_PROGRESS" ? 1 : 0,
          done: item.status === "DONE" ? 1 : 0,
          hasActiveTasks: item.status === "IN_PROGRESS",
        });
      }
    });

    return Array.from(workerMap.values());
  }, [todayBoard, workers]);

  if (teamData.length === 0) {
    return <p className="gc-empty">لا يوجد أعضاء في الفريق</p>;
  }

  return (
    <div className="gc-team-list">
      {teamData.map((worker) => (
        <div key={worker.name} className="gc-team-row">
          <div className="gc-team-avatar" style={{ background: worker.hasActiveTasks ? "#14b8a6" : "#6b7280" }}>
            {worker.name.charAt(0)}
          </div>
          <div className="gc-team-info">
            <div className="gc-team-name-row">
              <span className="gc-team-name">{worker.name}</span>
              <span className="gc-team-role">{worker.role}</span>
              <span
                className="gc-availability-dot"
                style={{ background: worker.hasActiveTasks ? "#10b981" : worker.total > 0 ? "#f59e0b" : "#6b7280" }}
                title={worker.hasActiveTasks ? "نشط" : worker.total > 0 ? "لديه مهام" : "خامل"}
              />
            </div>
            <div className="gc-team-stats">
              <span className="gc-team-stat">{worker.total} مهمة</span>
              <span className="gc-team-stat gc-stat-active">{worker.active} نشط</span>
              <span className="gc-team-stat gc-stat-done">{worker.done} منجز</span>
            </div>
            <div className="gc-team-bar">
              <div
                className="gc-team-bar-fill"
                style={{ width: `${worker.total > 0 ? (worker.done / worker.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
