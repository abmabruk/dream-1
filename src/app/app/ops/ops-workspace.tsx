"use client";

import "./ops-widgets.css";
import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";

import type { OpsBoardData } from "@/modules/projects/project.schemas";

import {
  type LayoutPreset,
  type OpsProjectWorkspace,
  type WidgetId,
  type WidgetLayout,
  defaultWidgetLayouts,
  layoutPresets,
  ALL_WIDGETS,
  post,
} from "./shared";

import { TodaysQueueWidget } from "./widgets/todays-queue-widget";
import { ProjectsWidget } from "./widgets/projects-widget";
import { AlertsWidget } from "./widgets/alerts-widget";
import { TeamStatusWidget } from "./widgets/team-status-widget";
import { QuickNotesWidget } from "./widgets/quick-notes-widget";
import { CalendarWidget } from "./widgets/calendar-widget";
import { ActivityFeedWidget } from "./widgets/activity-feed-widget";
import { DetailSheet } from "./widgets/detail-sheet";
import { AddWidgetDialog } from "./widgets/add-widget-dialog";
import { AddProjectDialog } from "./widgets/add-project-dialog";
import { WidgetHeader } from "./widgets/widget-header";

// ============================================================================
// Draggable Widget Wrapper
// ============================================================================

function DraggableWidget({
  widget,
  onToggleCollapse,
  onRemove,
  onResize,
  children,
}: {
  widget: WidgetLayout;
  onToggleCollapse: () => void;
  onRemove: () => void;
  onResize: (size: "small" | "medium" | "large" | "wide") => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
  });

  const style: React.CSSProperties = {
    gridColumn: `span ${widget.colSpan}`,
    gridRow: widget.collapsed ? "span 1" : `span ${widget.rowSpan}`,
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1,
    transition: isDragging ? "none" : "opacity 200ms",
  };

  return (
    <div ref={setNodeRef} className="gc-widget" style={style}>
      <WidgetHeader
        widget={widget}
        onToggleCollapse={onToggleCollapse}
        onRemove={onRemove}
        onResize={onResize}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
      {!widget.collapsed && (
        <div className="gc-widget-body">{children}</div>
      )}
    </div>
  );
}

// ============================================================================
// Drop Zone
// ============================================================================

function WidgetDropZone({ id, children }: { id: string; children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className="gc-grid"
      style={{
        outline: isOver ? "2px dashed #14b8a6" : "none",
        outlineOffset: "-2px",
      }}
    >
      {children}
    </div>
  );
}

// ============================================================================
// Main Workspace
// ============================================================================

export function OpsWorkspace({
  factoryName,
  canManage,
  initialBoard,
  initialProjects,
  workers,
  initialActivities,
}: {
  factoryName: string;
  canManage: boolean;
  initialBoard: OpsBoardData;
  initialProjects: OpsProjectWorkspace[];
  workers: { id: string; displayName: string; role: string }[];
  initialActivities: { id: string; type: string; message: string; actorName: string | null; createdAt: string }[];
}) {
  const router = useRouter();

  const [widgets, setWidgets] = useState<WidgetLayout[]>(defaultWidgetLayouts);
  const [preset, setPreset] = useState<LayoutPreset>("default");
  const [time, setTime] = useState("");
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [selectedProject, setSelectedProject] = useState<OpsProjectWorkspace | null>(null);
  const [dragActiveId, setDragActiveId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  // Clock
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-refresh pulse
  useEffect(() => {
    const id = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1500);
    }, 15000);
    return () => clearInterval(id);
  }, []);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  // Queue status change
  const handleStatusChange = useCallback(async (queueItemId: string, status: string) => {
    try {
      await post(`/api/v1/ops/queue/${queueItemId}/status`, { status });
      refresh();
    } catch {
      // silently fail
    }
  }, [refresh]);

  // Approve task
  const handleApprove = useCallback(async (taskId: string) => {
    try {
      await post(`/api/v1/projects/tasks/${taskId}/review`, { decision: "approve" });
      refresh();
    } catch {
      // silently fail
    }
  }, [refresh]);

  // Reject task
  const handleReject = useCallback(async (taskId: string) => {
    try {
      await post(`/api/v1/projects/tasks/${taskId}/review`, { decision: "reject" });
      refresh();
    } catch {
      // silently fail
    }
  }, [refresh]);

  // DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
  );

  const visibleWidgets = widgets.filter((w) => w.visible);
  const visibleIds = new Set(visibleWidgets.map((w) => w.id));

  const toggleCollapse = useCallback((id: WidgetId) => {
    setWidgets((prev) => prev.map((w) => w.id === id ? { ...w, collapsed: !w.collapsed } : w));
  }, []);

  const removeWidget = useCallback((id: WidgetId) => {
    setWidgets((prev) => prev.map((w) => w.id === id ? { ...w, visible: false } : w));
  }, []);

  const resizeWidget = useCallback((id: WidgetId, size: "small" | "medium" | "large" | "wide") => {
    const sizes = { small: [1, 1], medium: [2, 1], large: [2, 2], wide: [3, 1] };
    const [colSpan, rowSpan] = sizes[size];
    setWidgets((prev) => prev.map((w) => w.id === id ? { ...w, colSpan, rowSpan } : w));
  }, []);

  const addWidget = useCallback((id: WidgetId) => {
    setWidgets((prev) => prev.map((w) => w.id === id ? { ...w, visible: true, collapsed: false } : w));
  }, []);

  const applyPreset = useCallback((p: LayoutPreset) => {
    setPreset(p);
    setWidgets(layoutPresets[p]);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDragActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setWidgets((prev) => {
      const oldIndex = prev.findIndex((w) => w.id === active.id);
      const overWidget = prev.find((w) => w.id === over.id);

      if (oldIndex < 0) return prev;

      if (overWidget) {
        const newIndex = prev.findIndex((w) => w.id === over.id);
        const next = [...prev];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        return next;
      }

      return prev;
    });
  }, []);

  function renderWidgetContent(id: WidgetId) {
    switch (id) {
      case "todaysQueue":
        return (
          <TodaysQueueWidget
            todayBoard={initialBoard}
            canManage={canManage}
            onStatusChange={handleStatusChange}
            onApprove={handleApprove}
            onReject={handleReject}
            onRefresh={refresh}
          />
        );
      case "projects":
        return (
          <ProjectsWidget
            projects={initialProjects}
            onSelectProject={setSelectedProject}
            canManage={canManage}
            onRefresh={refresh}
          />
        );
      case "alerts":
        return (
          <AlertsWidget
            todayBoard={initialBoard}
            canManage={canManage}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        );
      case "teamStatus":
        return (
          <TeamStatusWidget
            todayBoard={initialBoard}
            workers={workers}
          />
        );
      case "quickNotes":
        return <QuickNotesWidget factoryName={factoryName} />;
      case "calendar":
        return <CalendarWidget projects={initialProjects} />;
      case "activityFeed":
        return <ActivityFeedWidget activities={initialActivities} />;
      default:
        return null;
    }
  }

  return (
    <div className="gc-screen">
      {/* Top Bar */}
      <header className="gc-topbar">
        <div className="gc-topbar-left">
          <h1 className="gc-factory-name">{factoryName}</h1>
          <span className="gc-topbar-label">العمليات</span>
        </div>

        <div className="gc-clock" suppressHydrationWarning>
          {time}
          {pulse && <span className="gc-pulse" />}
        </div>

        <div className="gc-topbar-actions">
          {canManage && (
            <button className="gc-topbar-btn" type="button" onClick={() => setShowAddProject(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              مشروع جديد
            </button>
          )}

          <button className="gc-topbar-btn" type="button" onClick={() => setShowAddWidget(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            إضافة ويدجت
          </button>

          <select
            className="gc-preset-select"
            value={preset}
            onChange={(e) => applyPreset(e.target.value as LayoutPreset)}
          >
            <option value="default">التخطيط الافتراضي</option>
            <option value="focus">تخطيط التركيز</option>
            <option value="overview">تخطيط عام</option>
          </select>
        </div>
      </header>

      {/* Widget Grid */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <WidgetDropZone id="grid">
          {visibleWidgets.map((widget) => (
            <DraggableWidget
              key={widget.id}
              widget={widget}
              onToggleCollapse={() => toggleCollapse(widget.id)}
              onRemove={() => removeWidget(widget.id)}
              onResize={(size) => resizeWidget(widget.id, size)}
            >
              {renderWidgetContent(widget.id)}
            </DraggableWidget>
          ))}
        </WidgetDropZone>

        <DragOverlay>
          {dragActiveId ? (
            <div className="gc-widget gc-drag-overlay" style={{ width: 300, height: 80 }}>
              <div className="gc-widget-header" style={{ borderTopColor: visibleWidgets.find((w) => w.id === dragActiveId)?.accentColor }}>
                <div className="gc-widget-header-left">
                  <div className="gc-widget-accent-dot" style={{ background: visibleWidgets.find((w) => w.id === dragActiveId)?.accentColor }} />
                  <span className="gc-widget-title">{visibleWidgets.find((w) => w.id === dragActiveId)?.title}</span>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Dialogs */}
      {showAddWidget && (
        <AddWidgetDialog
          visibleIds={visibleIds}
          onAdd={addWidget}
          onClose={() => setShowAddWidget(false)}
        />
      )}

      {showAddProject && (
        <AddProjectDialog
          onClose={() => setShowAddProject(false)}
          onRefresh={refresh}
        />
      )}

      {selectedProject && (
        <DetailSheet
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          canManage={canManage}
          onStatusChange={handleStatusChange}
          onApprove={handleApprove}
          onReject={handleReject}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
