"use client";

import { useMemo } from "react";
import { cls, PRIORITY_COLORS, type OpsProjectWorkspace } from "../shared";

export function CalendarWidget({ projects }: { projects: OpsProjectWorkspace[] }) {
  const week = useMemo(() => {
    const dayNames = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس"];
    const base = new Date();
    const dayOfWeek = base.getDay();

    const tasksByDate = new Map<string, { id: string; title: string; priority: string; projectCode: string }[]>();
    projects.forEach((proj) => {
      proj.tasks.forEach((task) => {
        if (!task.dueDate) return;
        const existing = tasksByDate.get(task.dueDate) || [];
        existing.push({ id: task.id, title: task.title, priority: task.priority, projectCode: proj.code });
        tasksByDate.set(task.dueDate, existing);
      });
    });

    return dayNames.map((dayName, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i - dayOfWeek);
      const dateStr = d.toISOString().slice(0, 10);
      const tasks = tasksByDate.get(dateStr) || [];
      return { day: String(d.getDate()), dayName, date: dateStr, tasks };
    });
  }, [projects]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="gc-calendar">
      {week.map((day) => (
        <div
          key={day.date}
          className={cls("gc-cal-day", day.date === today && "gc-cal-today")}
        >
          <div className="gc-cal-day-header">
            <span className="gc-cal-day-name">{day.dayName}</span>
            <span className="gc-cal-day-num">{day.day}</span>
          </div>
          <div className="gc-cal-tasks">
            {day.tasks.map((task) => (
              <div
                key={task.id}
                className="gc-cal-task"
                style={{ borderLeftColor: PRIORITY_COLORS[task.priority] || "#6b7280" }}
              >
                <span className="gc-cal-task-title">{task.title}</span>
                <span className="gc-cal-task-code">{task.projectCode}</span>
              </div>
            ))}
            {day.tasks.length === 0 && (
              <span className="gc-cal-empty">--</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
