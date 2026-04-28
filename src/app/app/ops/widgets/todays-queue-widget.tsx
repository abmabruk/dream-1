"use client";

import { useState } from "react";
import type { OpsBoardData } from "@/modules/projects/project.schemas";
import { TaskCard, useToast } from "@/components/ui";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { post, type QueueLane } from "../shared";

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
  const { toast } = useToast();

  async function handleSave() {
    setSaving(true);
    try {
      await post(`/api/v1/ops/queue/${queueItemId}/status`, {
        status: currentStatus,
        notes: text.trim() || undefined,
      });
      toast("✓ تم حفظ الملاحظة", "success");
      onSaved();
      onClose();
    } catch {
      toast("تعذّر الحفظ", "error");
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

// Map a kanban lane to the canonical status when a task is dropped on it.
function statusForLane(lane: QueueLane, requiresApproval: boolean): string {
  if (lane === "planned") return "PLANNED";
  if (lane === "active") return "IN_PROGRESS";
  // done: route through approval if needed
  return requiresApproval ? "WAITING_APPROVAL" : "DONE";
}

function QueueLaneCol({
  lane,
  label,
  items,
  accentColor,
  canManage,
  isMobile,
  draggingId,
  isDropTarget,
  onDragOver,
  onDragLeave,
  onDrop,
  onStatusChange,
  onApprove,
  onReject,
  onRefresh,
  onCardDragStart,
  onCardDragEnd,
  onMoveWithinLane,
}: {
  lane: QueueLane;
  label: string;
  items: { item: QueueItem; globalIndex: number }[];
  accentColor: string;
  canManage: boolean;
  isMobile: boolean;
  draggingId: string | null;
  isDropTarget: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onStatusChange: (queueItemId: string, status: string) => void;
  onMoveWithinLane: (queueItemId: string, direction: "up" | "down") => void;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  onRefresh: () => void;
  onCardDragStart: (id: string, requiresApproval: boolean) => void;
  onCardDragEnd: () => void;
}) {
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null);

  return (
    <div
      className="gc-lane"
      data-drop-target={isDropTarget ? "true" : "false"}
      onDragOver={canManage && !isMobile ? onDragOver : undefined}
      onDragLeave={canManage && !isMobile ? onDragLeave : undefined}
      onDrop={canManage && !isMobile ? onDrop : undefined}
      style={
        isDropTarget
          ? {
              outline: `2px dashed ${accentColor}`,
              outlineOffset: "-2px",
              background: `${accentColor}0d`,
            }
          : undefined
      }
    >
      <div className="gc-lane-header">
        <span className="gc-lane-label">{label}</span>
        <span className="gc-lane-count" style={{ background: `${accentColor}22`, color: accentColor }}>
          {items.length}
        </span>
      </div>
      <div className="gc-lane-body flex flex-col gap-2">
        {items.map(({ item, globalIndex }, idxInLane) => {
          const showStart = canManage && lane === "planned";
          const showApprove =
            canManage && lane === "active" && item.status === "WAITING_APPROVAL";
          const showReject = showApprove;
          const showDone = canManage && lane === "active" && item.status !== "WAITING_APPROVAL";

          // Mobile move buttons: swap to previous / next lane.
          // planned -> in_progress -> done
          const showMobilePrev = isMobile && canManage && (lane === "active" || lane === "done");
          const showMobileNext = isMobile && canManage && (lane === "planned" || (lane === "active" && item.status !== "WAITING_APPROVAL"));

          const isCardDragging = draggingId === item.id;
          return (
            <div
              key={item.id}
              data-queue-index={globalIndex}
              tabIndex={-1}
              draggable={canManage && !isMobile}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", item.id);
                onCardDragStart(item.id, item.task.requiresApproval);
              }}
              onDragEnd={onCardDragEnd}
              style={{
                opacity: isCardDragging ? 0.4 : 1,
                cursor: canManage && !isMobile ? (isCardDragging ? "grabbing" : "grab") : undefined,
                userSelect: canManage && !isMobile ? "none" : undefined,
                WebkitUserSelect: canManage && !isMobile ? "none" : undefined,
              }}
              onMouseDown={(e) => {
                // Prevent the parent dnd-kit (widget reorder) from capturing this gesture.
                e.stopPropagation();
              }}
            >
              <TaskCard
                id={item.id}
                title={item.task.title}
                status={item.status}
                priority={item.task.priority}
                projectCode={item.task.projectCode}
                projectId={item.task.projectId}
                assigneeName={item.assignedToName}
                lastActivityAt={item.task.updatedAt}
                onStart={showStart ? () => onStatusChange(item.id, "IN_PROGRESS") : undefined}
                onDone={
                  showDone
                    ? () =>
                        onStatusChange(
                          item.id,
                          item.task.requiresApproval ? "WAITING_APPROVAL" : "DONE",
                        )
                    : undefined
                }
                onApprove={showApprove ? () => onApprove(item.task.id) : undefined}
                onReject={showReject ? () => onReject(item.task.id) : undefined}
              >
                <div className="flex items-center gap-2 flex-wrap text-[0.65rem]">
                  <button
                    type="button"
                    className="gc-notes-indicator"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotesOpenId(notesOpenId === item.id ? null : item.id);
                    }}
                    title={item.notes ? "عرض/تعديل الملاحظات" : "إضافة ملاحظات"}
                  >
                    {item.notes ? "ملاحظة" : "+ ملاحظة"}
                  </button>
                  {canManage && lane === "active" && item.status !== "WAITING_APPROVAL" && !isMobile && (
                    <button
                      type="button"
                      className="gc-action-btn gc-action-back"
                      onClick={() => onStatusChange(item.id, "PLANNED")}
                    >
                      رجوع
                    </button>
                  )}
                  {lane === "done" && <span className="gc-done-check">منجز</span>}
                  {canManage && items.length > 1 && (
                    <span className="ms-auto inline-flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="نقل للأعلى"
                        title="نقل للأعلى"
                        disabled={idxInLane === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveWithinLane(item.id, "up");
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[0.7rem] disabled:opacity-30 hover:bg-[var(--surface-subtle)]"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        aria-label="نقل للأسفل"
                        title="نقل للأسفل"
                        disabled={idxInLane === items.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveWithinLane(item.id, "down");
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--panel)] text-[0.7rem] disabled:opacity-30 hover:bg-[var(--surface-subtle)]"
                      >
                        ↓
                      </button>
                    </span>
                  )}
                </div>

                {isMobile && (showMobilePrev || showMobileNext) ? (
                  <div className="mt-2 flex items-center gap-2">
                    {showMobilePrev ? (
                      <button
                        type="button"
                        className="dream-lane-move-btn"
                        aria-label="انقل إلى المسار السابق"
                        onClick={() =>
                          onStatusChange(
                            item.id,
                            lane === "done" ? "IN_PROGRESS" : "PLANNED",
                          )
                        }
                      >
                        ← السابق
                      </button>
                    ) : null}
                    {showMobileNext ? (
                      <button
                        type="button"
                        className="dream-lane-move-btn"
                        aria-label="انقل إلى المسار التالي"
                        onClick={() => {
                          if (lane === "planned") {
                            onStatusChange(item.id, "IN_PROGRESS");
                          } else if (lane === "active") {
                            onStatusChange(
                              item.id,
                              item.task.requiresApproval ? "WAITING_APPROVAL" : "DONE",
                            );
                          }
                        }}
                      >
                        التالي →
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {notesOpenId === item.id && (
                  <NotesPopover
                    queueItemId={item.id}
                    currentStatus={item.status}
                    initialNotes={item.notes || ""}
                    onSaved={onRefresh}
                    onClose={() => setNotesOpenId(null)}
                  />
                )}
              </TaskCard>
            </div>
          );
        })}
        {items.length === 0 && (
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
  const isMobile = useIsMobile();
  const indexed = todayBoard.queue.map((item, globalIndex) => ({ item, globalIndex }));
  const planned = indexed.filter(({ item }) => item.status === "PLANNED");
  const active = indexed.filter(({ item }) => ["IN_PROGRESS", "WAITING_APPROVAL"].includes(item.status));
  const done = indexed.filter(({ item }) => item.status === "DONE");

  const refresh = onRefresh || (() => {});

  // ── Drag-and-drop state (desktop only) ─────────────────────────────────
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingRequiresApproval, setDraggingRequiresApproval] = useState(false);
  const [hoverLane, setHoverLane] = useState<QueueLane | null>(null);

  const handleCardDragStart = (id: string, requiresApproval: boolean) => {
    setDraggingId(id);
    setDraggingRequiresApproval(requiresApproval);
  };
  const handleCardDragEnd = () => {
    setDraggingId(null);
    setHoverLane(null);
  };

  // Within-lane reorder: swap the queue item with its same-lane neighbor and
  // POST the full new ordering for today's date.
  const { toast } = useToast();
  const handleMoveWithinLane = async (queueItemId: string, direction: "up" | "down") => {
    // Determine the source lane bucket
    const sourceItem = indexed.find((x) => x.item.id === queueItemId);
    if (!sourceItem) return;
    const status = sourceItem.item.status;
    const laneItems =
      status === "PLANNED" ? planned :
      status === "DONE" ? done :
      active;
    const idx = laneItems.findIndex((x) => x.item.id === queueItemId);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= laneItems.length) return;

    // Build the new global order: same lane swapped, others untouched.
    const newGlobal = [...indexed];
    const sourceGlobal = sourceItem.globalIndex;
    const targetGlobal = laneItems[targetIdx].globalIndex;
    [newGlobal[sourceGlobal], newGlobal[targetGlobal]] = [newGlobal[targetGlobal], newGlobal[sourceGlobal]];
    const orderedQueueItemIds = newGlobal.map((x) => x.item.id);

    try {
      const workDate = new Date().toISOString().slice(0, 10);
      const res = await fetch("/api/v1/ops/queue/reorder", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workDate, orderedQueueItemIds }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast(direction === "up" ? "✓ تم النقل للأعلى" : "✓ تم النقل للأسفل", "success");
      refresh();
    } catch {
      toast("تعذّر النقل", "error");
    }
  };

  const makeLaneHandlers = (lane: QueueLane) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!draggingId) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (hoverLane !== lane) setHoverLane(lane);
    },
    onDragLeave: (e: React.DragEvent) => {
      // Only clear when leaving the lane wrapper itself (not its children).
      if (e.currentTarget === e.target) setHoverLane((cur) => (cur === lane ? null : cur));
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      if (!draggingId) return;
      const id = draggingId;
      const status = statusForLane(lane, draggingRequiresApproval);
      // Don't trigger if the card is already in the target lane.
      const item = indexed.find((x) => x.item.id === id)?.item;
      const currentLane: QueueLane | null = item
        ? item.status === "PLANNED"
          ? "planned"
          : item.status === "DONE"
            ? "done"
            : "active"
        : null;
      if (currentLane !== lane) {
        onStatusChange(id, status);
      }
      setDraggingId(null);
      setHoverLane(null);
    },
  });

  // The lane wrapper picks up `gc-kanban-mobile` from globals.css to switch
  // to a horizontal snap-scroll on phones (CSS-only swap; no JS layout).
  return (
    <div className={`gc-kanban ${isMobile ? "gc-kanban-mobile" : ""}`}>
      <QueueLaneCol
        lane="planned"
        label="مخطط"
        items={planned}
        accentColor="#8b5cf6"
        canManage={canManage}
        isMobile={isMobile}
        draggingId={draggingId}
        isDropTarget={hoverLane === "planned"}
        {...makeLaneHandlers("planned")}
        onStatusChange={onStatusChange}
        onApprove={onApprove}
        onReject={onReject}
        onRefresh={refresh}
        onCardDragStart={handleCardDragStart}
        onCardDragEnd={handleCardDragEnd}
        onMoveWithinLane={handleMoveWithinLane}
      />
      <QueueLaneCol
        lane="active"
        label="نشط"
        items={active}
        accentColor="#14b8a6"
        canManage={canManage}
        isMobile={isMobile}
        draggingId={draggingId}
        isDropTarget={hoverLane === "active"}
        {...makeLaneHandlers("active")}
        onStatusChange={onStatusChange}
        onApprove={onApprove}
        onReject={onReject}
        onRefresh={refresh}
        onCardDragStart={handleCardDragStart}
        onCardDragEnd={handleCardDragEnd}
        onMoveWithinLane={handleMoveWithinLane}
      />
      <QueueLaneCol
        lane="done"
        label="منجز"
        items={done}
        accentColor="#10b981"
        canManage={canManage}
        isMobile={isMobile}
        draggingId={draggingId}
        isDropTarget={hoverLane === "done"}
        {...makeLaneHandlers("done")}
        onStatusChange={onStatusChange}
        onApprove={onApprove}
        onReject={onReject}
        onRefresh={refresh}
        onCardDragStart={handleCardDragStart}
        onCardDragEnd={handleCardDragEnd}
        onMoveWithinLane={handleMoveWithinLane}
      />
    </div>
  );
}
