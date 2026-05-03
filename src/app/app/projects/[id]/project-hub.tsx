"use client";

/**
 * ProjectHub — client wrapper for the Project Hub tabs UI. The parent
 * server page fetches project + assignees and passes them as props; this
 * component owns all interactive behaviour (tab URL sync, action handlers,
 * toasts, refresh).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useCallback, useMemo, useState } from "react";

import {
  ActivityTimeline,
  EmptyState,
  MetricCard,
  PageHeader,
  ProjectCard,
  StatusPill,
  TaskCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
  type ActivityTimelineItem,
} from "@/components/ui";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/modules/projects/project-status";
import type { ProjectDetail } from "@/modules/projects/project.schemas";
import { formatDateAr as fmtDateAr } from "@/lib/format";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

import { CreateProjectTaskForm } from "./create-project-task-form";
import { LocationsPanel } from "./locations-panel";
import { FinancePanel } from "./finance-panel";
import { FilesGalleryPanel } from "./files-gallery-panel";
import { StagesTimeline } from "./stages-timeline";
import { StageDrawer } from "./stage-drawer";
import { TaskDetailSheet } from "./task-detail-sheet";
import { addTaskToTodayAction } from "./actions";

type Assignee = { id: string; displayName: string; role: string };
type FactoryUser = { id: string; firstName: string; displayName: string };

interface ProjectHubProps {
  project: ProjectDetail;
  assignees: Assignee[];
  factoryUsers: FactoryUser[];
  currentUserId: string;
  workDate: string;
  canManageProjects: boolean;
  canManageOps: boolean;
  canViewCosts: boolean;
  canManageCosts: boolean;
}

const TASK_LANES: {
  id: "BACKLOG" | "PLANNED_TODAY" | "IN_PROGRESS" | "WAITING_APPROVAL" | "DONE";
  label: string;
}[] = [
  { id: "BACKLOG", label: "البنك" },
  { id: "PLANNED_TODAY", label: "اليوم" },
  { id: "IN_PROGRESS", label: "قيد التنفيذ" },
  { id: "WAITING_APPROVAL", label: "بانتظار الموافقة" },
  { id: "DONE", label: "منجز" },
];

function formatDateAr(value: string | null) {
  if (!value) return "لا يوجد تاريخ";
  const out = fmtDateAr(value);
  return out === "—" ? "لا يوجد تاريخ" : out;
}

async function postJson(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const p = (await r.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    throw new Error(p?.error?.message || "فشل الطلب.");
  }
  return r.json().catch(() => null);
}

export function ProjectHub({
  project,
  assignees,
  factoryUsers,
  currentUserId,
  workDate,
  canManageProjects,
  canManageOps,
  canViewCosts,
  canManageCosts,
}: ProjectHubProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [openStageInstanceId, setOpenStageInstanceId] = useState<string | null>(null);
  const [backfillBusy, setBackfillBusy] = useState(false);

  const refresh = useCallback(() => router.refresh(), [router]);

  const isMobile = useIsMobile();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverLane, setHoverLane] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"status" | "stage" | "location">("status");
  const [activityStageFilter, setActivityStageFilter] = useState<string>("all");

  // Metrics ---------------------------------------------------------------
  // `nowMs` is captured once on first render via a state initializer
  // (which the lint rule treats as deterministic) so the `useMemo` body
  // stays pure given its dependencies.
  const [nowMs] = useState<number>(() => Date.now());
  const metrics = useMemo(() => {
    const total = project.tasks.length;
    const done = project.tasks.filter((t) => t.status === "DONE").length;
    const open = total - done;
    const queuedToday = project.tasks.filter((t) => t.todayQueueItem).length;
    const waitingApproval = project.tasks.filter(
      (t) => t.status === "WAITING_APPROVAL"
    ).length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    const dueDate = project.dueDate;
    const isOverdue =
      !!dueDate &&
      new Date(dueDate).getTime() < nowMs &&
      project.status !== "COMPLETED";
    return {
      total,
      done,
      open,
      queuedToday,
      waitingApproval,
      progress,
      dueDate,
      isOverdue,
    };
  }, [project, nowMs]);

  // Lane bucketing --------------------------------------------------------
  const lanes = useMemo(() => {
    const map: Record<string, ProjectDetail["tasks"]> = {
      BACKLOG: [],
      PLANNED_TODAY: [],
      IN_PROGRESS: [],
      WAITING_APPROVAL: [],
      DONE: [],
    };
    for (const task of project.tasks) {
      const key = map[task.status] ? task.status : "BACKLOG";
      map[key].push(task);
    }
    return map;
  }, [project.tasks]);

  // Wave 3 — stage-grouped lanes ----------------------------------------
  const sortedStages = useMemo(
    () =>
      [...project.stageInstances].sort((a, b) => a.sortOrder - b.sortOrder),
    [project.stageInstances]
  );

  const stageLanes = useMemo(() => {
    const out: { id: string; label: string; color: string }[] = [
      { id: "_none", label: "بدون مرحلة", color: "#6b7280" },
      ...sortedStages.map((s, i) => ({
        id: s.id,
        label: s.name,
        color:
          s.status === "COMPLETED"
            ? "#10b981"
            : s.status === "IN_PROGRESS"
              ? "#14b8a6"
              : s.status === "BLOCKED"
                ? "#ef4444"
                : i % 2
                  ? "#8b5cf6"
                  : "#3b82f6",
      })),
    ];
    return out;
  }, [sortedStages]);

  const stageBuckets = useMemo(() => {
    const map: Record<string, ProjectDetail["tasks"]> = { _none: [] };
    for (const s of sortedStages) map[s.id] = [];
    for (const task of project.tasks) {
      const key =
        task.stageInstanceId && map[task.stageInstanceId] !== undefined
          ? task.stageInstanceId
          : "_none";
      map[key].push(task);
    }
    return map;
  }, [project.tasks, sortedStages]);

  // Wave 4 — location-grouped lanes ----------------------------------------
  const sortedLocations = useMemo(
    () =>
      [...project.locations].sort((a, b) => a.sortOrder - b.sortOrder),
    [project.locations]
  );

  const locationLanes = useMemo(() => {
    const out: { id: string; label: string; color: string }[] = [
      { id: "_none", label: "بدون موقع", color: "#6b7280" },
      ...sortedLocations.map((l, i) => ({
        id: l.id,
        label: l.code ? `${l.name} · ${l.code}` : l.name,
        color: ["#3b82f6", "#8b5cf6", "#14b8a6", "#f59e0b", "#10b981", "#ec4899"][i % 6],
      })),
    ];
    return out;
  }, [sortedLocations]);

  const locationBuckets = useMemo(() => {
    const map: Record<string, ProjectDetail["tasks"]> = { _none: [] };
    for (const l of sortedLocations) map[l.id] = [];
    for (const task of project.tasks) {
      const key =
        task.locationId && map[task.locationId] !== undefined
          ? task.locationId
          : "_none";
      map[key].push(task);
    }
    return map;
  }, [project.tasks, sortedLocations]);

  // Handlers --------------------------------------------------------------
  const handleApprove = useCallback(
    async (taskId: string) => {
      try {
        await postJson(`/api/v1/projects/tasks/${taskId}/review`, {
          decision: "approve",
        });
        toast("تمّت الموافقة", "success");
        refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "تعذّرت الموافقة", "error");
      }
    },
    [toast, refresh]
  );

  const handleReject = useCallback(
    async (taskId: string) => {
      try {
        await postJson(`/api/v1/projects/tasks/${taskId}/review`, {
          decision: "reject",
        });
        toast("تمّ الرفض", "info");
        refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "تعذّر الرفض", "error");
      }
    },
    [toast, refresh]
  );

  const handleStart = useCallback(
    async (queueItemId: string) => {
      try {
        await postJson(`/api/v1/ops/queue/${queueItemId}/status`, {
          status: "IN_PROGRESS",
        });
        toast("تم البدء", "success");
        refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "تعذّر التحديث", "error");
      }
    },
    [toast, refresh]
  );

  const handleDone = useCallback(
    async (queueItemId: string) => {
      try {
        await postJson(`/api/v1/ops/queue/${queueItemId}/status`, {
          status: "DONE",
        });
        toast("تم الإنجاز", "success");
        refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "تعذّر التحديث", "error");
      }
    },
    [toast, refresh]
  );

  const handleAddToToday = useCallback(
    async (taskId: string, assignedToUserId: string | null) => {
      try {
        const fd = new FormData();
        fd.set("projectId", project.id);
        fd.set("taskId", taskId);
        fd.set("workDate", workDate);
        fd.set("assignedToUserId", assignedToUserId ?? "");
        await addTaskToTodayAction(fd);
        toast("أُضيفت إلى اليوم", "success");
        refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "تعذّرت الإضافة", "error");
      }
    },
    [project.id, workDate, toast, refresh]
  );


  const updateTaskStatus = useCallback(
    async (taskId: string, status: string) => {
      try {
        const r = await fetch(`/api/v1/projects/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!r.ok) {
          const p = (await r.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(p?.error?.message || "فشل الطلب.");
        }
        toast("✓ نُقلت المهمة", "success");
        refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "تعذّر النقل", "error");
      }
    },
    [toast, refresh]
  );

  const updateTaskStage = useCallback(
    async (taskId: string, stageInstanceId: string | null) => {
      try {
        const r = await fetch(`/api/v1/projects/tasks/${taskId}/stage`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stageInstanceId }),
        });
        if (!r.ok) {
          const p = (await r.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(p?.error?.message || "فشل الطلب.");
        }
        toast("✓ نُقلت المهمة إلى المرحلة", "success");
        refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "تعذّر النقل", "error");
      }
    },
    [toast, refresh]
  );

  const updateTaskLocation = useCallback(
    async (taskId: string, locationId: string | null) => {
      try {
        const r = await fetch(`/api/v1/projects/tasks/${taskId}/location`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ locationId }),
        });
        if (!r.ok) {
          const p = (await r.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          throw new Error(p?.error?.message || "فشل الطلب.");
        }
        toast("✓ نُقلت المهمة إلى الموقع", "success");
        refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "تعذّر النقل", "error");
      }
    },
    [toast, refresh]
  );

  const handleExport = useCallback(() => {
    const url = `/api/v1/projects/${project.id}/export`;
    window.location.href = url;
  }, [project.id]);

  // Activity timeline -----------------------------------------------------
  const activityItems: ActivityTimelineItem[] = project.activities.map(
    (a) => ({
      id: a.id,
      type: a.type,
      message: a.message,
      actorName: a.actorName,
      createdAt: a.createdAt,
      stageInstanceId: a.stageInstanceId,
    })
  );

  const handleBackfill = useCallback(async () => {
    setBackfillBusy(true);
    try {
      await postJson(`/api/v1/projects/${project.id}/stages/backfill`, {});
      toast("تمت تهيئة المراحل", "success");
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذّرت تهيئة المراحل", "error");
    } finally {
      setBackfillBusy(false);
    }
  }, [project.id, toast, refresh]);

  const openStageInstance = openStageInstanceId
    ? project.stageInstances.find((s) => s.id === openStageInstanceId) ?? null
    : null;

  // -----------------------------------------------------------------------
  return (
    <main className="space-y-6">
      <PageHeader
        caption={project.code}
        title={
          <span className="inline-flex items-center gap-3">
            {project.name}
            <StatusPill status={project.status} />
          </span>
        }
        description={
          project.description ||
          `${PROJECT_STATUS_LABELS[project.status]} · أولوية ${PROJECT_PRIORITY_LABELS[project.priority]} · المالك ${project.ownerName || "غير مسند"}`
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="button-secondary"
              onClick={handleExport}
              title="تنزيل المشروع كملف JSON"
            >
              تصدير
            </button>
            <Link className="button-secondary" href="/app/ops">
              فتح عمليات اليوم
            </Link>
          </div>
        }
      />

      {/* Wave 2 — stages timeline (or legacy backfill banner) */}
      {project.stageInstances.length > 0 ? (
        <StagesTimeline
          stageInstances={project.stageInstances}
          projectId={project.id}
          canManage={canManageProjects}
          onOpenStage={(id) => setOpenStageInstanceId(id)}
        />
      ) : (
        <section
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/50 bg-amber-50/60 p-4 text-sm"
          aria-label="تنبيه المراحل"
        >
          <p className="text-amber-900">
            هذا المشروع تم إنشاؤه قبل تفعيل المراحل. اضغط <span className="font-semibold">إنشاء المراحل</span> لإضافتها.
          </p>
          {canManageProjects ? (
            <button
              type="button"
              className="button-primary"
              onClick={handleBackfill}
              disabled={backfillBusy}
            >
              {backfillBusy ? "جاري الإنشاء..." : "إنشاء المراحل"}
            </button>
          ) : null}
        </section>
      )}

      {/* Header progress bar */}
      <section
        className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4"
        aria-label="تقدّم المشروع"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted-foreground)]">
            {metrics.done}/{metrics.total} مهام · {metrics.progress}%
          </p>
          {metrics.progress >= 100 && metrics.dueDate ? (
            <span className="text-xs font-medium text-[var(--tone-active-fg)]">
              مكتمل
            </span>
          ) : metrics.isOverdue ? (
            <span className="text-xs font-medium text-amber-600">
              متجاوز الاستحقاق
            </span>
          ) : null}
        </div>
        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--border)]"
          role="progressbar"
          aria-valuenow={metrics.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${metrics.progress}%`,
              background:
                metrics.progress >= 100
                  ? "var(--tone-done-fg)"
                  : metrics.isOverdue
                    ? "var(--tone-waiting-fg)"
                    : "var(--accent)",
            }}
          />
        </div>
      </section>

      {/* Summary band */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="عدد المهام"
          value={metrics.total}
          sublabel={`${metrics.open} مفتوحة · ${metrics.done} منجزة`}
        />
        <MetricCard
          label="مجدول اليوم"
          value={metrics.queuedToday}
          tone={metrics.queuedToday > 0 ? "accent" : "muted"}
        />
        <MetricCard
          label="بانتظار الموافقة"
          value={metrics.waitingApproval}
          tone={metrics.waitingApproval > 0 ? "warn" : "muted"}
        />
        <MetricCard
          label="تاريخ الاستحقاق"
          value={
            <span className="text-2xl">{formatDateAr(metrics.dueDate)}</span>
          }
          tone={metrics.isOverdue ? "danger" : "default"}
          sublabel={metrics.isOverdue ? "متجاوز الاستحقاق" : undefined}
        />
        <MetricCard
          label="تقدّم"
          value={`${metrics.progress}%`}
          tone={metrics.progress >= 100 ? "accent" : "default"}
          sublabel={`${metrics.done} / ${metrics.total}`}
        />
      </section>

      {/* Tabs */}
      <Suspense fallback={<div className="panel">جاري التحميل…</div>}>
        <Tabs defaultValue="tasks">
          <TabsList ariaLabel="أقسام المشروع">
            <TabsTrigger value="tasks">المهام</TabsTrigger>
            <TabsTrigger value="activity">السجل</TabsTrigger>
            <TabsTrigger value="files">الملفات</TabsTrigger>
            {canViewCosts ? (
              <TabsTrigger value="finance">الماليات</TabsTrigger>
            ) : null}
            <TabsTrigger value="locations">المواقع</TabsTrigger>
            <TabsTrigger value="related">المرتبطات</TabsTrigger>
          </TabsList>

          {/* Tasks tab */}
          <TabsContent className="mt-4 py-6" value="tasks">
            <section className="panel space-y-4">
              {canManageProjects ? (
                <div>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => setShowCreate((v) => !v)}
                  >
                    {showCreate ? "إخفاء النموذج" : "+ مهمة جديدة"}
                  </button>
                  {showCreate ? (
                    <div className="mt-4">
                      <CreateProjectTaskForm
                        assignees={assignees}
                        projectId={project.id}
                        stageInstances={project.stageInstances}
                        defaultStageInstanceId={
                          project.currentStageInstance?.id ?? null
                        }
                        locations={project.locations}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {project.tasks.length === 0 ? (
                <EmptyState
                  heading="لا توجد مهام بعد"
                  description="ابدأ بإضافة أول خطوة تشغيلية لهذا المشروع."
                  action={
                    canManageProjects ? (
                      <button
                        type="button"
                        className="button-primary"
                        onClick={() => setShowCreate(true)}
                      >
                        + إنشاء مهمة
                      </button>
                    ) : null
                  }
                >
                  <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
                    <rect x="20" y="18" width="56" height="60" rx="8" fill="var(--accent)" fillOpacity="0.10" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="2"/>
                    <path d="M30 36 L66 36 M30 48 L60 48 M30 60 L52 60" stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="2.2" strokeLinecap="round"/>
                    <circle cx="44" cy="42" r="3" fill="var(--accent)"/>
                  </svg>
                </EmptyState>
              ) : (
                <>
                  {/* Wave 3+4 — view mode toggle */}
                  {project.stageInstances.length > 0 || project.locations.length > 0 ? (
                    <div className="mb-3 inline-flex rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-1 text-xs">
                      <button
                        type="button"
                        className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${viewMode === "status" ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)]"}`}
                        onClick={() => setViewMode("status")}
                        aria-pressed={viewMode === "status"}
                      >
                        حسب الحالة
                      </button>
                      {project.stageInstances.length > 0 ? (
                        <button
                          type="button"
                          className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${viewMode === "stage" ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)]"}`}
                          onClick={() => setViewMode("stage")}
                          aria-pressed={viewMode === "stage"}
                        >
                          حسب المرحلة
                        </button>
                      ) : null}
                      {project.locations.length > 0 ? (
                        <button
                          type="button"
                          className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${viewMode === "location" ? "bg-[var(--accent)] text-white" : "text-[var(--muted-foreground)]"}`}
                          onClick={() => setViewMode("location")}
                          aria-pressed={viewMode === "location"}
                        >
                          حسب الموقع
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                {viewMode === "location" && project.locations.length > 0 ? (
                  <div
                    className="dream-hub-lanes-mobile grid gap-4 overflow-x-auto"
                    style={{
                      gridTemplateColumns: `repeat(${locationLanes.length}, minmax(240px, 1fr))`,
                    }}
                  >
                    {locationLanes.map((lane) => {
                      const accent = lane.color;
                      const isDropTarget = hoverLane === `loc:${lane.id}`;
                      const dndEnabled = canManageProjects && !isMobile;
                      const tasksInLane = locationBuckets[lane.id] ?? [];
                      return (
                        <div
                          key={lane.id}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3"
                          style={
                            isDropTarget
                              ? {
                                  outline: `2px dashed ${accent}`,
                                  outlineOffset: "-2px",
                                  background: `${accent}0d`,
                                }
                              : undefined
                          }
                          onDragOver={
                            dndEnabled
                              ? (e) => {
                                  if (!draggingId) return;
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = "move";
                                  const key = `loc:${lane.id}`;
                                  if (hoverLane !== key) setHoverLane(key);
                                }
                              : undefined
                          }
                          onDragLeave={
                            dndEnabled
                              ? (e) => {
                                  if (e.currentTarget === e.target) {
                                    setHoverLane((cur) => (cur === `loc:${lane.id}` ? null : cur));
                                  }
                                }
                              : undefined
                          }
                          onDrop={
                            dndEnabled
                              ? (e) => {
                                  e.preventDefault();
                                  if (!draggingId) return;
                                  const id = draggingId;
                                  const draggedTask = project.tasks.find(
                                    (t) => t.id === id,
                                  );
                                  const targetLocId = lane.id === "_none" ? null : lane.id;
                                  const currentLocId = draggedTask?.locationId ?? null;
                                  if (draggedTask && currentLocId !== targetLocId) {
                                    updateTaskLocation(id, targetLocId);
                                  }
                                  setDraggingId(null);
                                  setHoverLane(null);
                                }
                              : undefined
                          }
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">{lane.label}</h3>
                            <span
                              className="rounded-full px-2 py-0.5 text-xs"
                              style={{ background: `${accent}22`, color: accent }}
                            >
                              {tasksInLane.length}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {tasksInLane.length === 0 ? (
                              <p className="text-xs text-[var(--muted-foreground)]">—</p>
                            ) : (
                              tasksInLane.map((task) => {
                                const isCardDragging = draggingId === task.id;
                                return (
                                  <div
                                    key={task.id}
                                    draggable={dndEnabled}
                                    onDragStart={
                                      dndEnabled
                                        ? (e) => {
                                            e.dataTransfer.effectAllowed = "move";
                                            e.dataTransfer.setData("text/plain", task.id);
                                            setDraggingId(task.id);
                                          }
                                        : undefined
                                    }
                                    onDragEnd={
                                      dndEnabled
                                        ? () => {
                                            setDraggingId(null);
                                            setHoverLane(null);
                                          }
                                        : undefined
                                    }
                                    onMouseDown={(e) => e.stopPropagation()}
                                    style={{
                                      opacity: isCardDragging ? 0.4 : 1,
                                      cursor: dndEnabled
                                        ? isCardDragging
                                          ? "grabbing"
                                          : "grab"
                                        : undefined,
                                      userSelect: dndEnabled ? "none" : undefined,
                                      WebkitUserSelect: dndEnabled ? "none" : undefined,
                                    }}
                                  >
                                    <TaskCard
                                      id={task.id}
                                      title={task.title}
                                      status={task.status}
                                      priority={task.priority}
                                      projectCode={project.code}
                                      dueDate={task.dueDate}
                                      lastActivityAt={task.updatedAt}
                                      assigneeName={task.assignedToName}
                                      stageName={task.stageName}
                                      locationName={task.locationName}
                                      onClick={() => setOpenTaskId(task.id)}
                                    />
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : viewMode === "stage" && project.stageInstances.length > 0 ? (
                  <div
                    className="dream-hub-lanes-mobile grid gap-4 overflow-x-auto"
                    style={{
                      gridTemplateColumns: `repeat(${stageLanes.length}, minmax(240px, 1fr))`,
                    }}
                  >
                    {stageLanes.map((lane) => {
                      const accent = lane.color;
                      const isDropTarget = hoverLane === `stage:${lane.id}`;
                      const dndEnabled = canManageProjects && !isMobile;
                      const tasksInLane = stageBuckets[lane.id] ?? [];
                      return (
                        <div
                          key={lane.id}
                          className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3"
                          style={
                            isDropTarget
                              ? {
                                  outline: `2px dashed ${accent}`,
                                  outlineOffset: "-2px",
                                  background: `${accent}0d`,
                                }
                              : undefined
                          }
                          onDragOver={
                            dndEnabled
                              ? (e) => {
                                  if (!draggingId) return;
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = "move";
                                  const key = `stage:${lane.id}`;
                                  if (hoverLane !== key) setHoverLane(key);
                                }
                              : undefined
                          }
                          onDragLeave={
                            dndEnabled
                              ? (e) => {
                                  if (e.currentTarget === e.target) {
                                    setHoverLane((cur) => (cur === `stage:${lane.id}` ? null : cur));
                                  }
                                }
                              : undefined
                          }
                          onDrop={
                            dndEnabled
                              ? (e) => {
                                  e.preventDefault();
                                  if (!draggingId) return;
                                  const id = draggingId;
                                  const draggedTask = project.tasks.find(
                                    (t) => t.id === id,
                                  );
                                  const targetStageId = lane.id === "_none" ? null : lane.id;
                                  const currentStageId = draggedTask?.stageInstanceId ?? null;
                                  if (draggedTask && currentStageId !== targetStageId) {
                                    updateTaskStage(id, targetStageId);
                                  }
                                  setDraggingId(null);
                                  setHoverLane(null);
                                }
                              : undefined
                          }
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-sm font-semibold">{lane.label}</h3>
                            <span
                              className="rounded-full px-2 py-0.5 text-xs"
                              style={{ background: `${accent}22`, color: accent }}
                            >
                              {tasksInLane.length}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {tasksInLane.length === 0 ? (
                              <p className="text-xs text-[var(--muted-foreground)]">—</p>
                            ) : (
                              tasksInLane.map((task) => {
                                const isCardDragging = draggingId === task.id;
                                return (
                                  <div
                                    key={task.id}
                                    draggable={dndEnabled}
                                    onDragStart={
                                      dndEnabled
                                        ? (e) => {
                                            e.dataTransfer.effectAllowed = "move";
                                            e.dataTransfer.setData("text/plain", task.id);
                                            setDraggingId(task.id);
                                          }
                                        : undefined
                                    }
                                    onDragEnd={
                                      dndEnabled
                                        ? () => {
                                            setDraggingId(null);
                                            setHoverLane(null);
                                          }
                                        : undefined
                                    }
                                    onMouseDown={(e) => e.stopPropagation()}
                                    style={{
                                      opacity: isCardDragging ? 0.4 : 1,
                                      cursor: dndEnabled
                                        ? isCardDragging
                                          ? "grabbing"
                                          : "grab"
                                        : undefined,
                                      userSelect: dndEnabled ? "none" : undefined,
                                      WebkitUserSelect: dndEnabled ? "none" : undefined,
                                    }}
                                  >
                                    <TaskCard
                                      id={task.id}
                                      title={task.title}
                                      status={task.status}
                                      priority={task.priority}
                                      projectCode={project.code}
                                      dueDate={task.dueDate}
                                      lastActivityAt={task.updatedAt}
                                      assigneeName={task.assignedToName}
                                      stageName={task.stageName}
                                      locationName={task.locationName}
                                      onClick={() => setOpenTaskId(task.id)}
                                    />
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                <div
                  className="dream-hub-lanes-mobile grid gap-4 overflow-x-auto"
                  style={{
                    gridTemplateColumns: "repeat(5, minmax(240px, 1fr))",
                  }}
                >
                  {TASK_LANES.map((lane) => {
                    const accent =
                      lane.id === "BACKLOG"
                        ? "#6b7280"
                        : lane.id === "PLANNED_TODAY"
                          ? "#8b5cf6"
                          : lane.id === "IN_PROGRESS"
                            ? "#14b8a6"
                            : lane.id === "WAITING_APPROVAL"
                              ? "#f59e0b"
                              : "#10b981";
                    const isDropTarget = hoverLane === lane.id;
                    const dndEnabled = canManageProjects && !isMobile;
                    return (
                      <div
                        key={lane.id}
                        className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3"
                        style={
                          isDropTarget
                            ? {
                                outline: `2px dashed ${accent}`,
                                outlineOffset: "-2px",
                                background: `${accent}0d`,
                              }
                            : undefined
                        }
                        onDragOver={
                          dndEnabled
                            ? (e) => {
                                if (!draggingId) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (hoverLane !== lane.id) setHoverLane(lane.id);
                              }
                            : undefined
                        }
                        onDragLeave={
                          dndEnabled
                            ? (e) => {
                                if (e.currentTarget === e.target) {
                                  setHoverLane((cur) => (cur === lane.id ? null : cur));
                                }
                              }
                            : undefined
                        }
                        onDrop={
                          dndEnabled
                            ? (e) => {
                                e.preventDefault();
                                if (!draggingId) return;
                                const id = draggingId;
                                const draggedTask = project.tasks.find(
                                  (t) => t.id === id
                                );
                                if (draggedTask && draggedTask.status !== lane.id) {
                                  updateTaskStatus(id, lane.id);
                                }
                                setDraggingId(null);
                                setHoverLane(null);
                              }
                            : undefined
                        }
                      >
                        <div className="mb-3 flex items-center justify-between">
                          <h3 className="text-sm font-semibold">{lane.label}</h3>
                          <span
                            className="rounded-full px-2 py-0.5 text-xs"
                            style={{
                              background: `${accent}22`,
                              color: accent,
                            }}
                          >
                            {lanes[lane.id].length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {lanes[lane.id].length === 0 ? (
                            <p className="text-xs text-[var(--muted-foreground)]">
                              —
                            </p>
                          ) : (
                            lanes[lane.id].map((task) => {
                              const queueId = task.todayQueueItem?.id;
                              const canApprove =
                                canManageOps &&
                                task.status === "WAITING_APPROVAL";
                              const isCardDragging = draggingId === task.id;
                              return (
                                <div
                                  key={task.id}
                                  draggable={dndEnabled}
                                  onDragStart={
                                    dndEnabled
                                      ? (e) => {
                                          e.dataTransfer.effectAllowed = "move";
                                          e.dataTransfer.setData("text/plain", task.id);
                                          setDraggingId(task.id);
                                        }
                                      : undefined
                                  }
                                  onDragEnd={
                                    dndEnabled
                                      ? () => {
                                          setDraggingId(null);
                                          setHoverLane(null);
                                        }
                                      : undefined
                                  }
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                  }}
                                  style={{
                                    opacity: isCardDragging ? 0.4 : 1,
                                    cursor: dndEnabled
                                      ? isCardDragging
                                        ? "grabbing"
                                        : "grab"
                                      : undefined,
                                    userSelect: dndEnabled ? "none" : undefined,
                                    WebkitUserSelect: dndEnabled ? "none" : undefined,
                                  }}
                                >
                                  <TaskCard
                                    id={task.id}
                                    title={task.title}
                                    status={task.status}
                                    priority={task.priority}
                                    projectCode={project.code}
                                    dueDate={task.dueDate}
                                    lastActivityAt={task.updatedAt}
                                    assigneeName={task.assignedToName}
                                    stageName={task.stageName}
                                    locationName={task.locationName}
                                    onClick={() => setOpenTaskId(task.id)}
                                    onApprove={
                                      canApprove
                                        ? () => handleApprove(task.id)
                                        : undefined
                                    }
                                    onReject={
                                      canApprove
                                        ? () => handleReject(task.id)
                                        : undefined
                                    }
                                    onStart={
                                      canManageOps &&
                                      queueId &&
                                      task.todayQueueItem?.status === "PLANNED"
                                        ? () => handleStart(queueId)
                                        : undefined
                                    }
                                    onDone={
                                      canManageOps &&
                                      queueId &&
                                      task.todayQueueItem?.status ===
                                        "IN_PROGRESS" &&
                                      !task.requiresApproval
                                        ? () => handleDone(queueId)
                                        : undefined
                                    }
                                  >
                                    {!task.todayQueueItem &&
                                    canManageOps &&
                                    !["DONE", "CANCELLED"].includes(task.status) ? (
                                      <button
                                        type="button"
                                        className="text-xs text-[var(--accent)] hover:underline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleAddToToday(
                                            task.id,
                                            task.assignedToUserId
                                          );
                                        }}
                                      >
                                        + إضافة إلى اليوم
                                      </button>
                                    ) : null}
                                    {task.rejectedReason ? (
                                      <p className="text-xs text-[var(--tone-blocked-fg)]">
                                        سبب الرفض: {task.rejectedReason}
                                      </p>
                                    ) : null}
                                  </TaskCard>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                )}
                </>
              )}
            </section>
          </TabsContent>

          {/* Activity tab */}
          <TabsContent className="mt-4 py-6" value="activity">
            <section className="panel">
              <h2 className="text-xl font-semibold">السجل الزمني</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                أحدث {activityItems.length} حدث، الأحدث أولاً.
              </p>
              {project.stageInstances.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-[var(--muted-foreground)]">
                    تصفية:
                  </span>
                  {(
                    [
                      { id: "all", label: "الكل" },
                      ...sortedStages.map((s) => ({ id: s.id, label: s.name })),
                      { id: "none", label: "بدون مرحلة" },
                    ] as { id: string; label: string }[]
                  ).map((chip) => {
                    const active = activityStageFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setActivityStageFilter(chip.id)}
                        className={`rounded-full border px-2.5 py-1 text-[0.7rem] font-medium transition-colors ${
                          active
                            ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                            : "bg-[var(--panel-strong)] text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]"
                        }`}
                        aria-pressed={active}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="mt-5">
                <ActivityTimeline
                  activities={activityItems}
                  stageFilter={activityStageFilter}
                />
              </div>
            </section>
          </TabsContent>

          {/* Files tab — gallery of all attachments across tasks */}
          <TabsContent className="mt-4 py-6" value="files">
            <FilesGalleryPanel
              projectId={project.id}
              tasks={project.tasks.map((t) => ({ id: t.id, title: t.title }))}
              currentUserId={currentUserId}
              canManage={canManageProjects}
              onOpenTask={(taskId) => setOpenTaskId(taskId)}
            />
          </TabsContent>

          {/* Locations tab */}
          <TabsContent className="mt-4 py-6" value="locations">
            <LocationsPanel
              projectId={project.id}
              locations={project.locations}
              canManage={canManageProjects}
            />
          </TabsContent>

          {/* Finance tab */}
          {canViewCosts ? (
            <TabsContent className="mt-4 py-6" value="finance">
              <FinancePanel
                projectId={project.id}
                projectCode={project.code}
                canManageCosts={canManageCosts}
                tasks={project.tasks.map((t) => ({ id: t.id, title: t.title }))}
                stageInstances={project.stageInstances}
                defaultStageInstanceId={
                  project.currentStageInstance?.id ?? null
                }
                locations={project.locations.map((l) => ({ id: l.id, name: l.name, code: l.code }))}
              />
            </TabsContent>
          ) : null}

          {/* Related tab */}
          <TabsContent className="mt-4 py-6" value="related">
            <section className="space-y-4">
              {project.orderId || project.customerName ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {project.orderId ? (
                    <Link
                      href={`/app/orders/${project.orderId}`}
                      className="block"
                    >
                      <ProjectCard
                        code={project.orderCode || "—"}
                        name={`الطلب المرتبط${
                          project.customerName
                            ? ` · ${project.customerName}`
                            : ""
                        }`}
                        status={project.status}
                        priority={project.priority}
                        ownerName={project.ownerName}
                        dueDate={project.dueDate}
                      />
                    </Link>
                  ) : null}
                  {project.customerName ? (
                    <div className="panel">
                      <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                        العميل
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold">
                        {project.customerName}
                      </h2>
                      <Link
                        href="/app/customers"
                        className="mt-3 inline-block text-sm text-[var(--accent)] hover:underline"
                      >
                        فتح صفحة العملاء →
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : (
                <EmptyState
                  heading="لا توجد ارتباطات"
                  description="هذا المشروع غير مرتبط بطلب أو عميل بعد."
                />
              )}
            </section>
          </TabsContent>
        </Tabs>
      </Suspense>

      {/* Phase 6 — Memory features: comments + attachments */}
      <StageDrawer
        open={openStageInstanceId !== null}
        onClose={() => setOpenStageInstanceId(null)}
        projectId={project.id}
        stageInstance={openStageInstance}
        stageInstances={project.stageInstances}
        canManage={canManageProjects}
      />

      <TaskDetailSheet
        open={openTaskId !== null}
        onClose={() => setOpenTaskId(null)}
        projectId={project.id}
        task={
          openTaskId
            ? project.tasks.find((t) => t.id === openTaskId) ?? null
            : null
        }
        factoryUsers={factoryUsers}
        currentUserId={currentUserId}
        canManage={canManageProjects}
      />
    </main>
  );
}
