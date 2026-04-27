"use client";

import { timeAgo } from "../shared";

export function ActivityFeedWidget({ activities }: {
  activities: { id: string; type: string; message: string; actorName: string | null; createdAt: string }[];
}) {
  const typeIcons: Record<string, { color: string; icon: string }> = {
    completed: { color: "#10b981", icon: "check" },
    task_completed: { color: "#10b981", icon: "check" },
    moved: { color: "#3b82f6", icon: "arrow" },
    task_status_changed: { color: "#3b82f6", icon: "arrow" },
    approval: { color: "#f59e0b", icon: "clock" },
    task_review_requested: { color: "#f59e0b", icon: "clock" },
    task_approved: { color: "#10b981", icon: "check" },
    task_rejected: { color: "#ef4444", icon: "block" },
    blocked: { color: "#ef4444", icon: "block" },
    created: { color: "#8b5cf6", icon: "plus" },
    task_created: { color: "#8b5cf6", icon: "plus" },
    project_created: { color: "#8b5cf6", icon: "plus" },
    queue_added: { color: "#3b82f6", icon: "arrow" },
    queue_reordered: { color: "#3b82f6", icon: "arrow" },
  };

  if (activities.length === 0) {
    return <p className="gc-empty">لا يوجد نشاط حديث</p>;
  }

  return (
    <div className="gc-feed">
      {activities.map((activity) => {
        const t = typeIcons[activity.type] || { color: "#6b7280", icon: "dot" };
        return (
          <div key={activity.id} className="gc-feed-item">
            <div className="gc-feed-icon" style={{ background: `${t.color}22`, color: t.color }}>
              {t.icon === "check" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              )}
              {t.icon === "arrow" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              )}
              {t.icon === "clock" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              )}
              {t.icon === "block" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
              )}
              {t.icon === "plus" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              )}
              {t.icon === "dot" && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="4" /></svg>
              )}
            </div>
            <div className="gc-feed-body">
              <p className="gc-feed-msg">{activity.message}</p>
              <span className="gc-feed-time">{timeAgo(activity.createdAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
