"use client";

import { useState } from "react";
import type { OpsBoardData } from "@/modules/projects/project.schemas";
import { PRIORITY_COLORS, STATUS_COLORS, post, type QueueLane } from "../shared";

type QueueItem = OpsBoardData["queue"][number];

function NotesPopover({
  queueItemId,
  currentStatus,
  initialNotes,
  onSaved,
  onClose,
}: {
  queueItemId: string;
  currentStatus: string;
  initialNotes: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await post(`/api/v1/ops/queue/${queueItemId}/status`, {
        status: currentStatus,
        notes: text.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch {
      // fail silently; parent will catch
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gc-notes-popover" onClick={(e) => e.stopPropagation()}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="أضف ملاحظات..."
        autoFocus
      />
      <div className="gc-notes-popover-actions">
        <button type="button" className="gc-inline-cancel" onClick={onClose}>إلغاء</button>
        <button type="button" className="gc-inline-submit" onClick={handleSave} disabled={saving}>
          {saving ? "..." : "حفظ"}
        </button>
      </div>
    </div>
  );
}

function QueueLaneCol({
  lane,
  label,
  tasks,
  accentColor,
  canManage,
  onStatusChange,
  onApprove,
  onReject,
  onRefresh,
}: {
  lane: QueueLane;
  label: string;
  tasks: QueueItem[];
  accentColor: string;
  canManage: boolean;
  onStatusChange: (queueItemId: string, status: string) => void;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  onRefresh: () => void;
}) {
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null);

  return (
    <div className="gc-lane">
      <div className="gc-lane-header">
        <span className="gc-lane-label">{label}</span>
        <span className="gc-lane-count" style={{ background: `${accentColor}22`, color: accentColor }}>
          {tasks.length}
        </span>
      </div>
      <div className="gc-lane-body">
        {tasks.map((item) => (
          <div
            key={item.id}
            className="gc-queue-card"
            style={{ borderLeftColor: PRIORITY_COLORS[item.task.priority] || "#6b7280" }}
          >
            <div className="gc-queue-card-top">
              <span className="gc-queue-card-title">{item.task.title}</span>
              <span
                className="gc-queue-card-priority"
                style={{ color: PRIORITY_COLORS[item.task.priority] }}
              >
                {item.task.priority === "URGENT" ? "!!" : item.task.priority === "HIGH" ? "!" : ""}
              </span>
            </div>
            <div className="gc-queue-card-meta">
              <span className="gc-tag" style={{ background: `${STATUS_COLORS[item.status]}18`, color: STATUS_COLORS[item.status] }}>
                {item.task.projectCode}
              </span>
              {item.assignedToName && (
                <span className="gc-queue-card-worker">{item.assignedToName}</span>
              )}
              <span
                className="gc-notes-indicator"
                onClick={(e) => {
                  e.stopPropagation();
                  setNotesOpenId(notesOpenId === item.id ? null : item.id);
                }}
                title={item.notes ? "عرض/تعديل الملاحظات" : "إضافة ملاحظات"}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {item.notes ? "notes" : "+"}
              </span>
            </div>
            {notesOpenId === item.id && (
              <NotesPopover
                queueItemId={item.id}
                currentStatus={item.status}
                initialNotes={item.notes || ""}
                onSaved={onRefresh}
                onClose={() => setNotesOpenId(null)}
              />
            )}
            {canManage && (
              <div className="gc-queue-card-actions">
                {lane === "planned" && (
                  <button
                    className="gc-action-btn gc-action-start"
                    onClick={() => onStatusChange(item.id, "IN_PROGRESS")}
                    type="button"
                  >
                    ابدأ
                  </button>
                )}
                {lane === "active" && item.status === "WAITING_APPROVAL" && (
                  <>
                    <button
                      className="gc-action-btn gc-action-complete"
                      onClick={() => onApprove(item.task.id)}
                      type="button"
                    >
                      موافقة
                    </button>
                    <button
                      className="gc-action-btn gc-action-back"
                      onClick={() => onReject(item.task.id)}
                      type="button"
                    >
                      رفض
                    </button>
                  </>
                )}
                {lane === "active" && item.status !== "WAITING_APPROVAL" && (
                  <>
                    <button
                      className="gc-action-btn gc-action-complete"
                      onClick={() => onStatusChange(item.id, item.task.requiresApproval ? "WAITING_APPROVAL" : "DONE")}
                      type="button"
                    >
                      {item.task.requiresApproval ? "إرسال" : "أكمل"}
                    </button>
                    <button
                      className="gc-action-btn gc-action-back"
                      onClick={() => onStatusChange(item.id, "PLANNED")}
                      type="button"
                    >
                      رجوع
                    </button>
                  </>
                )}
                {lane === "done" && (
                  <span className="gc-done-check">منجز</span>
                )}
              </div>
            )}
            {!canManage && lane === "done" && (
              <div className="gc-queue-card-actions">
                <span className="gc-done-check">منجز</span>
              </div>
            )}
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="gc-empty">لا توجد مهام</p>
        )}
      </div>
    </div>
  );
}

export function TodaysQueueWidget({
  todayBoard,
  canManage,
  onStatusChange,
  onApprove,
  onReject,
  onRefresh,
}: {
  todayBoard: OpsBoardData;
  canManage: boolean;
  onStatusChange: (queueItemId: string, status: string) => void;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  onRefresh?: () => void;
}) {
  const planned = todayBoard.queue.filter((i) => i.status === "PLANNED");
  const active = todayBoard.queue.filter((i) => ["IN_PROGRESS", "WAITING_APPROVAL"].includes(i.status));
  const done = todayBoard.queue.filter((i) => i.status === "DONE");

  const refresh = onRefresh || (() => {});

  return (
    <div className="gc-kanban">
      <QueueLaneCol lane="planned" label="مخطط" tasks={planned} accentColor="#8b5cf6" canManage={canManage} onStatusChange={onStatusChange} onApprove={onApprove} onReject={onReject} onRefresh={refresh} />
      <QueueLaneCol lane="active" label="نشط" tasks={active} accentColor="#14b8a6" canManage={canManage} onStatusChange={onStatusChange} onApprove={onApprove} onReject={onReject} onRefresh={refresh} />
      <QueueLaneCol lane="done" label="منجز" tasks={done} accentColor="#10b981" canManage={canManage} onStatusChange={onStatusChange} onApprove={onApprove} onReject={onReject} onRefresh={refresh} />
    </div>
  );
}
