"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { startTransition, useDeferredValue, useEffect, useState, useTransition } from "react";

import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_TASK_STATUS_LABELS,
  TASK_APPROVAL_STATUS_LABELS,
  WORK_QUEUE_STATUS_LABELS,
} from "@/modules/projects/project-status";
import type {
  OpsBoardData,
  ProjectDetail,
  ProjectListItem,
} from "@/modules/projects/project.schemas";

type OpsProjectWorkspace = ProjectDetail & Pick<
  ProjectListItem,
  "openTaskCount" | "queuedTodayCount" | "waitingApprovalCount"
>;

type QueueItem = OpsBoardData["queue"][number];
type ProjectTask = ProjectDetail["tasks"][number];

const PROJECT_TONES = [
  {
    accent: "#0f766e",
    soft: "rgba(15, 118, 110, 0.14)",
    border: "rgba(15, 118, 110, 0.28)",
  },
  {
    accent: "#c2410c",
    soft: "rgba(194, 65, 12, 0.14)",
    border: "rgba(194, 65, 12, 0.28)",
  },
  {
    accent: "#1d4ed8",
    soft: "rgba(29, 78, 216, 0.14)",
    border: "rgba(29, 78, 216, 0.28)",
  },
  {
    accent: "#be185d",
    soft: "rgba(190, 24, 93, 0.14)",
    border: "rgba(190, 24, 93, 0.28)",
  },
  {
    accent: "#7c3aed",
    soft: "rgba(124, 58, 237, 0.14)",
    border: "rgba(124, 58, 237, 0.28)",
  },
] as const;

function formatDate(value: string | null) {
  if (!value) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function statusActionLabel(item: QueueItem) {
  if (item.task.requiresApproval) {
    if (item.status === "WAITING_APPROVAL") {
      return "Waiting approval";
    }

    if (item.status === "DONE") {
      return "Approved";
    }

    return "Ready for approval";
  }

  if (item.status === "DONE") {
    return "Completed";
  }

  return "Mark done";
}

function nextActionStatus(item: QueueItem) {
  if (item.task.requiresApproval) {
    return "WAITING_APPROVAL";
  }

  return "DONE";
}

async function readApiError(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { error?: { message?: string } }
    | null;

  return payload?.error?.message || "Request failed.";
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json().catch(() => null);
}

function findProjectByTask(projects: OpsProjectWorkspace[], taskId: string) {
  return projects.find((project) => project.tasks.some((task) => task.id === taskId)) ?? null;
}

function buildScheduledTaskIds(todayQueue: QueueItem[], tomorrowQueue: QueueItem[]) {
  return new Set(
    [...todayQueue, ...tomorrowQueue].map((item) => item.task.id)
  );
}

function ProjectRailCard({
  active,
  index,
  onSelect,
  project,
  todayQueue,
  tomorrowQueue,
}: {
  active: boolean;
  index: number;
  onSelect: () => void;
  project: OpsProjectWorkspace;
  todayQueue: QueueItem[];
  tomorrowQueue: QueueItem[];
}) {
  const tone = PROJECT_TONES[index % PROJECT_TONES.length];
  const todayCount = todayQueue.filter((item) => item.task.projectId === project.id).length;
  const tomorrowCount = tomorrowQueue.filter((item) => item.task.projectId === project.id).length;
  const approvals = [...todayQueue, ...tomorrowQueue].filter(
    (item) =>
      item.task.projectId === project.id &&
      item.status === "WAITING_APPROVAL"
  ).length;
  const blocked = project.tasks.filter((task) => task.status === "BLOCKED").length;

  return (
    <button
      className="ops-project-card text-left"
      onClick={onSelect}
      style={{
        borderColor: active ? tone.accent : tone.border,
        background: active
          ? `linear-gradient(180deg, ${tone.soft} 0%, rgba(255,255,255,0.96) 100%)`
          : "rgba(255,255,255,0.86)",
        boxShadow: active ? `0 18px 48px ${tone.soft}` : undefined,
      }}
      type="button"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            {project.code}
          </p>
          <h2 className="mt-2 text-xl font-semibold">{project.name}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {project.description || "No project description yet."}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: tone.accent }}
        >
          {PROJECT_STATUS_LABELS[project.status]}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-[var(--muted-foreground)]">Today</p>
          <p className="mt-1 font-semibold">{todayCount}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Tomorrow</p>
          <p className="mt-1 font-semibold">{tomorrowCount}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Approval</p>
          <p className="mt-1 font-semibold">{approvals}</p>
        </div>
        <div>
          <p className="text-[var(--muted-foreground)]">Blocked</p>
          <p className="mt-1 font-semibold">{blocked}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-[var(--muted-foreground)]">
        <span>{project.ownerName || "No owner"}</span>
        <span>{formatDate(project.dueDate)}</span>
      </div>
    </button>
  );
}

function ProjectTaskCard({
  dragging,
  task,
  toneIndex,
}: {
  dragging?: boolean;
  task: ProjectTask;
  toneIndex: number;
}) {
  const tone = PROJECT_TONES[toneIndex % PROJECT_TONES.length];

  return (
    <article
      className="ops-task-card"
      style={{
        opacity: dragging ? 0.42 : 1,
        borderColor: tone.border,
        background: `linear-gradient(180deg, ${tone.soft} 0%, rgba(255,255,255,0.94) 100%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{task.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {task.description || "No task description yet."}
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: tone.accent }}
        >
          {PROJECT_PRIORITY_LABELS[task.priority]}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="ops-chip">{PROJECT_TASK_STATUS_LABELS[task.status]}</span>
        <span className="ops-chip">{task.assignedToName || "Unassigned"}</span>
        <span className="ops-chip">{formatDate(task.dueDate)}</span>
        {task.requiresApproval && <span className="ops-chip">Needs approval</span>}
      </div>
    </article>
  );
}

function DraggableTaskPoolCard({
  disabled,
  task,
  toneIndex,
}: {
  disabled: boolean;
  task: ProjectTask;
  toneIndex: number;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task:${task.id}`,
    disabled,
    data: {
      type: "task",
      taskId: task.id,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
      }}
      suppressHydrationWarning
      {...attributes}
      {...listeners}
    >
      <ProjectTaskCard dragging={isDragging} task={task} toneIndex={toneIndex} />
    </div>
  );
}

function QueueTaskCard({
  canManage,
  item,
  onApprove,
  onReject,
  onQuickState,
  toneIndex,
}: {
  canManage: boolean;
  item: QueueItem;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  onQuickState: (queueItemId: string, status: string) => void;
  toneIndex: number;
}) {
  const tone = PROJECT_TONES[toneIndex % PROJECT_TONES.length];

  return (
    <article
      className="ops-queue-card"
      style={{
        borderColor: tone.border,
        background: `linear-gradient(180deg, ${tone.soft} 0%, rgba(255,255,255,0.96) 100%)`,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            {item.task.projectCode}
          </p>
          <h3 className="mt-2 text-xl font-semibold">{item.task.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            {item.task.description || "No task description yet."}
          </p>
        </div>
        <div className="text-right">
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ background: tone.accent }}
          >
            {WORK_QUEUE_STATUS_LABELS[item.status]}
          </span>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            #{item.position}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted-foreground)]">
        <span className="ops-chip">{item.task.projectName}</span>
        <span className="ops-chip">{item.assignedToName || "Unassigned"}</span>
        <span className="ops-chip">{PROJECT_PRIORITY_LABELS[item.task.priority]}</span>
        <span className="ops-chip">
          {item.task.requiresApproval
            ? TASK_APPROVAL_STATUS_LABELS[item.task.approvalStatus]
            : "No approval"}
        </span>
      </div>

      {canManage && (
        <div className="mt-4 flex flex-wrap gap-2">
          {item.status === "PLANNED" && (
            <button
              className="button-secondary"
              onClick={() => onQuickState(item.id, "IN_PROGRESS")}
              type="button"
            >
              Start
            </button>
          )}
          {item.status !== "BLOCKED" && item.status !== "DONE" && (
            <button
              className="button-secondary"
              onClick={() => onQuickState(item.id, "BLOCKED")}
              type="button"
            >
              Block
            </button>
          )}
          {item.status !== "DONE" && item.status !== "WAITING_APPROVAL" && (
            <button
              className="button-primary"
              onClick={() => onQuickState(item.id, nextActionStatus(item))}
              type="button"
            >
              {statusActionLabel(item)}
            </button>
          )}
          {item.status === "WAITING_APPROVAL" && (
            <>
              <button
                className="button-primary"
                onClick={() => onApprove(item.task.id)}
                type="button"
              >
                Approve
              </button>
              <button
                className="button-secondary"
                onClick={() => onReject(item.task.id)}
                type="button"
              >
                Reject
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function SortableQueueCard({
  canManage,
  item,
  onApprove,
  onReject,
  onQuickState,
  toneIndex,
}: {
  canManage: boolean;
  item: QueueItem;
  onApprove: (taskId: string) => void;
  onReject: (taskId: string) => void;
  onQuickState: (queueItemId: string, status: string) => void;
  toneIndex: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: `queue:${item.id}`,
      disabled: !canManage,
      data: {
        type: "queue",
        queueItemId: item.id,
      },
    });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
      }}
      suppressHydrationWarning
      {...attributes}
      {...listeners}
    >
      <QueueTaskCard
        canManage={canManage}
        item={item}
        onApprove={onApprove}
        onQuickState={onQuickState}
        onReject={onReject}
        toneIndex={toneIndex}
      />
    </div>
  );
}

function Lane({
  children,
  count,
  id,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  count: number;
  id: "today" | "tomorrow";
  subtitle: string;
  title: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id,
  });

  return (
    <section
      ref={setNodeRef}
      className="ops-lane"
      style={{
        borderColor: isOver ? "rgba(15, 118, 110, 0.35)" : undefined,
        boxShadow: isOver ? "0 0 0 4px rgba(15, 118, 110, 0.08)" : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            {subtitle}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
        </div>
        <span className="ops-count-pill">{count}</span>
      </div>
      <div className="ops-lane-body">{children}</div>
    </section>
  );
}

export function OpsWorkspace({
  canManage,
  factoryName,
  projects,
  todayBoard,
  tomorrowBoard,
}: {
  canManage: boolean;
  factoryName: string;
  projects: OpsProjectWorkspace[];
  todayBoard: OpsBoardData;
  tomorrowBoard: OpsBoardData;
}) {
  const router = useRouter();
  const [isPending] = useTransition();
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id ?? "");
  const [todayQueue, setTodayQueue] = useState(todayBoard.queue);
  const [tomorrowQueue, setTomorrowQueue] = useState(tomorrowBoard.queue);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const deferredSelectedProjectId = useDeferredValue(selectedProjectId);

  useEffect(() => {
    setTodayQueue(todayBoard.queue);
    setTomorrowQueue(tomorrowBoard.queue);
  }, [todayBoard.queue, tomorrowBoard.queue]);

  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const selectedProject =
    projects.find((project) => project.id === deferredSelectedProjectId) ?? projects[0] ?? null;
  const scheduledTaskIds = buildScheduledTaskIds(todayQueue, tomorrowQueue);
  const projectPool =
    selectedProject?.tasks.filter(
      (task) =>
        !scheduledTaskIds.has(task.id) &&
        !["DONE", "CANCELLED"].includes(task.status)
    ) ?? [];
  const approvals = [...todayQueue, ...tomorrowQueue].filter(
    (item) => item.status === "WAITING_APPROVAL"
  );
  const blockedItems = [...todayQueue, ...tomorrowQueue].filter(
    (item) => item.status === "BLOCKED"
  );
  const forgottenTasks = projects.flatMap((project) =>
    project.tasks
      .filter(
        (task) =>
          !scheduledTaskIds.has(task.id) &&
          !["DONE", "CANCELLED"].includes(task.status) &&
          (task.status === "BLOCKED" || Boolean(task.dueDate))
      )
      .map((task) => ({
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        task,
      }))
  );

  async function runMutation(label: string, work: () => Promise<void>, rollback?: () => void) {
    setErrorMessage(null);
    setSavingLabel(label);

    try {
      await work();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      rollback?.();
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setSavingLabel(null);
    }
  }

  function getContainer(id: string) {
    if (id === "pool" || id === "today" || id === "tomorrow") {
      return id;
    }

    if (id.startsWith("task:")) {
      return "pool";
    }

    const queueId = id.replace("queue:", "");

    if (todayQueue.some((item) => item.id === queueId)) {
      return "today";
    }

    if (tomorrowQueue.some((item) => item.id === queueId)) {
      return "tomorrow";
    }

    return null;
  }

  function queueState(container: "today" | "tomorrow") {
    return container === "today" ? todayQueue : tomorrowQueue;
  }

  function setQueueState(container: "today" | "tomorrow", items: QueueItem[]) {
    if (container === "today") {
      setTodayQueue(items);
      return;
    }

    setTomorrowQueue(items);
  }

  function optimisticQueueItem(task: ProjectTask, project: OpsProjectWorkspace, target: "today" | "tomorrow") {
    const queue = queueState(target);

    return {
      id: `temp-${task.id}-${target}`,
      position: queue.length + 1,
      status: "PLANNED" as const,
      notes: null,
      assignedToName: task.assignedToName,
      assignedToUserId: task.assignedToUserId,
      startedAt: null,
      completedAt: null,
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        requiresApproval: task.requiresApproval,
        approvalStatus: task.approvalStatus,
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
      },
    } satisfies QueueItem;
  }

  async function quickUpdateStatus(queueItemId: string, status: string) {
    const previousToday = todayQueue;
    const previousTomorrow = tomorrowQueue;
    const updateLocal = (items: QueueItem[]): QueueItem[] =>
      items.map((item) =>
        item.id === queueItemId
          ? {
              ...item,
              status: status as QueueItem["status"],
              task: {
                ...item.task,
                approvalStatus: (
                  status === "WAITING_APPROVAL" ? "PENDING" : item.task.approvalStatus
                ) as QueueItem["task"]["approvalStatus"],
              },
            }
          : item
      );

    setTodayQueue(updateLocal(todayQueue));
    setTomorrowQueue(updateLocal(tomorrowQueue));

    await runMutation(
      "Updating task status...",
      async () => {
        await postJson(`/api/v1/ops/queue/${queueItemId}/status`, { status });
      },
      () => {
        setTodayQueue(previousToday);
        setTomorrowQueue(previousTomorrow);
      }
    );
  }

  async function reviewTask(taskId: string, decision: "approve" | "reject") {
    const previousToday = todayQueue;
    const previousTomorrow = tomorrowQueue;
    const updateLocal = (items: QueueItem[]): QueueItem[] =>
      items.map((item) =>
        item.task.id === taskId
          ? {
              ...item,
              status: (decision === "approve" ? "DONE" : "IN_PROGRESS") as QueueItem["status"],
              task: {
                ...item.task,
                approvalStatus: (
                  decision === "approve" ? "APPROVED" : "REJECTED"
                ) as QueueItem["task"]["approvalStatus"],
              },
            }
          : item
      );

    setTodayQueue(updateLocal(todayQueue));
    setTomorrowQueue(updateLocal(tomorrowQueue));

    await runMutation(
      decision === "approve" ? "Approving task..." : "Rejecting task...",
      async () => {
        await postJson(`/api/v1/projects/tasks/${taskId}/review`, {
          decision,
          note: decision === "reject" ? "Needs revision" : undefined,
        });
      },
      () => {
        setTodayQueue(previousToday);
        setTomorrowQueue(previousTomorrow);
      }
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);

    if (!canManage || !event.over) {
      return;
    }

    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    const source = getContainer(activeId);
    const target = getContainer(overId);

    if (!source || !target) {
      return;
    }

    if (activeId.startsWith("task:") && (target === "today" || target === "tomorrow")) {
      const taskId = activeId.replace("task:", "");
      const project = findProjectByTask(projects, taskId);
      const task = project?.tasks.find((item) => item.id === taskId) ?? null;

      if (!project || !task) {
        return;
      }

      const beforeQueueItemId = overId.startsWith("queue:") ? overId.replace("queue:", "") : undefined;
      const previousToday = todayQueue;
      const previousTomorrow = tomorrowQueue;
      const nextItem = optimisticQueueItem(task, project, target);
      const nextTarget = [...queueState(target)];
      const beforeIndex = beforeQueueItemId
        ? nextTarget.findIndex((item) => item.id === beforeQueueItemId)
        : -1;

      if (beforeIndex >= 0) {
        nextTarget.splice(beforeIndex, 0, nextItem);
      } else {
        nextTarget.push(nextItem);
      }

      setQueueState(target, nextTarget);

      await runMutation(
        target === "today" ? "Scheduling for today..." : "Scheduling for tomorrow...",
        async () => {
          await postJson("/api/v1/ops/queue", {
            taskId,
            workDate: target === "today" ? todayBoard.date : tomorrowBoard.date,
            assignedToUserId: task.assignedToUserId || undefined,
            beforeQueueItemId,
          });
        },
        () => {
          setTodayQueue(previousToday);
          setTomorrowQueue(previousTomorrow);
        }
      );

      return;
    }

    if (!activeId.startsWith("queue:") || (target !== "today" && target !== "tomorrow")) {
      return;
    }

    const activeQueueId = activeId.replace("queue:", "");
    const fromContainer = source as "today" | "tomorrow";
    const toContainer = target as "today" | "tomorrow";
    const sourceItems = [...queueState(fromContainer)];
    const targetItems = fromContainer === toContainer ? sourceItems : [...queueState(toContainer)];
    const sourceIndex = sourceItems.findIndex((item) => item.id === activeQueueId);

    if (sourceIndex < 0) {
      return;
    }

    const movedItem = sourceItems[sourceIndex];
    const targetIndex = overId.startsWith("queue:")
      ? targetItems.findIndex((item) => item.id === overId.replace("queue:", ""))
      : targetItems.length;
    const beforeQueueItemId = overId.startsWith("queue:") ? overId.replace("queue:", "") : undefined;
    const previousToday = todayQueue;
    const previousTomorrow = tomorrowQueue;

    if (fromContainer === toContainer) {
      if (sourceIndex === targetIndex || sourceIndex === targetIndex - 1) {
        return;
      }

      const nextItems = arrayMove(
        sourceItems,
        sourceIndex,
        Math.max(0, targetIndex)
      ).map((item, index) => ({
        ...item,
        position: index + 1,
      }));

      setQueueState(fromContainer, nextItems);

      await runMutation(
        "Reordering queue...",
        async () => {
          await postJson("/api/v1/ops/queue/reorder", {
            workDate: fromContainer === "today" ? todayBoard.date : tomorrowBoard.date,
            orderedQueueItemIds: nextItems.map((item) => item.id).filter((id) => !id.startsWith("temp-")),
          });
        },
        () => {
          setTodayQueue(previousToday);
          setTomorrowQueue(previousTomorrow);
        }
      );

      return;
    }

    const nextSource = sourceItems.filter((item) => item.id !== activeQueueId).map((item, index) => ({
      ...item,
      position: index + 1,
    }));
    const insertionIndex = targetIndex >= 0 ? targetIndex : targetItems.length;
    const nextTarget = [...targetItems];
    nextTarget.splice(insertionIndex, 0, movedItem);
    const normalizedTarget = nextTarget.map((item, index) => ({
      ...item,
      position: index + 1,
    }));

    setQueueState(fromContainer, nextSource);
    setQueueState(toContainer, normalizedTarget);

    await runMutation(
      toContainer === "today" ? "Moving into today..." : "Moving into tomorrow...",
      async () => {
        await postJson(`/api/v1/ops/queue/${activeQueueId}/schedule`, {
          targetDate: toContainer === "today" ? todayBoard.date : tomorrowBoard.date,
          beforeQueueItemId,
        });
      },
      () => {
        setTodayQueue(previousToday);
        setTomorrowQueue(previousTomorrow);
      }
    );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  const overlayTask =
    activeDragId?.startsWith("task:")
      ? projectPool.find((task) => task.id === activeDragId.replace("task:", "")) ?? null
      : null;
  const overlayQueue =
    activeDragId?.startsWith("queue:")
      ? [...todayQueue, ...tomorrowQueue].find(
          (item) => item.id === activeDragId.replace("queue:", "")
        ) ?? null
      : null;

  return (
    <main className="ops-screen">
      <section className="ops-hero">
        <div>
          <p className="text-sm uppercase tracking-[0.28em] text-[var(--muted-foreground)]">
            {factoryName}
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight">Factory command board</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
            Projects stay visible on top, tasks flow into Today and Tomorrow, and approvals never
            disappear into the background.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="button-secondary" href="/app/projects">
            Projects archive
          </Link>
          <Link className="button-secondary" href="/app/orders">
            Orders
          </Link>
        </div>
      </section>

      <section className="ops-kpi-grid">
        <article className="ops-kpi-card">
          <p>Today lane</p>
          <strong>{todayQueue.length}</strong>
        </article>
        <article className="ops-kpi-card">
          <p>Tomorrow lane</p>
          <strong>{tomorrowQueue.length}</strong>
        </article>
        <article className="ops-kpi-card">
          <p>Waiting approval</p>
          <strong>{approvals.length}</strong>
        </article>
        <article className="ops-kpi-card">
          <p>Blocked</p>
          <strong>{blockedItems.length}</strong>
        </article>
        <article className="ops-kpi-card">
          <p>Forgotten tasks</p>
          <strong>{forgottenTasks.length}</strong>
        </article>
      </section>

      <section className="ops-project-rail">
        {projects.map((project, index) => (
          <ProjectRailCard
            active={project.id === selectedProjectId}
            index={index}
            key={project.id}
            onSelect={() => setSelectedProjectId(project.id)}
            project={project}
            todayQueue={todayQueue}
            tomorrowQueue={tomorrowQueue}
          />
        ))}
      </section>

      <DndContext
        collisionDetection={closestCorners}
        onDragEnd={(event) => {
          startTransition(() => {
            void handleDragEnd(event);
          });
        }}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <section className="ops-main-grid">
          <section className="ops-task-pool">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                  Project task pool
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {selectedProject?.name || "Select a project"}
                </h2>
              </div>
              {selectedProject && (
                <span className="ops-count-pill">{projectPool.length}</span>
              )}
            </div>

            <div className="mt-5 space-y-4">
              {selectedProject ? (
                <>
                  <p className="text-sm leading-7 text-[var(--muted-foreground)]">
                    {selectedProject.description || "No project description yet."}
                  </p>
                  {projectPool.length === 0 ? (
                    <div className="ops-empty-state">
                      All open tasks from this project are already scheduled into Today or Tomorrow.
                    </div>
                  ) : (
                    projectPool.map((task) => (
                      <DraggableTaskPoolCard
                        disabled={!canManage || isPending}
                        key={task.id}
                        task={task}
                        toneIndex={projects.findIndex((project) => project.id === selectedProject.id)}
                      />
                    ))
                  )}
                </>
              ) : (
                <div className="ops-empty-state">No project is available yet.</div>
              )}
            </div>
          </section>

          <div className="grid gap-6">
            <Lane count={todayQueue.length} id="today" subtitle={todayBoard.date} title="Today">
              <SortableContext
                items={todayQueue.map((item) => `queue:${item.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {todayQueue.length === 0 ? (
                  <div className="ops-empty-state">
                    Drop tasks here for today&apos;s live execution order.
                  </div>
                ) : (
                  todayQueue.map((item) => (
                    <SortableQueueCard
                      canManage={canManage && !isPending}
                      item={item}
                      key={item.id}
                      onApprove={(taskId) => void reviewTask(taskId, "approve")}
                      onQuickState={(queueItemId, status) => void quickUpdateStatus(queueItemId, status)}
                      onReject={(taskId) => void reviewTask(taskId, "reject")}
                      toneIndex={projects.findIndex((project) => project.id === item.task.projectId)}
                    />
                  ))
                )}
              </SortableContext>
            </Lane>

            <Lane
              count={tomorrowQueue.length}
              id="tomorrow"
              subtitle={tomorrowBoard.date}
              title="Tomorrow"
            >
              <SortableContext
                items={tomorrowQueue.map((item) => `queue:${item.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {tomorrowQueue.length === 0 ? (
                  <div className="ops-empty-state">
                    Stage tomorrow&apos;s work here so the next shift already knows the queue.
                  </div>
                ) : (
                  tomorrowQueue.map((item) => (
                    <SortableQueueCard
                      canManage={canManage && !isPending}
                      item={item}
                      key={item.id}
                      onApprove={(taskId) => void reviewTask(taskId, "approve")}
                      onQuickState={(queueItemId, status) => void quickUpdateStatus(queueItemId, status)}
                      onReject={(taskId) => void reviewTask(taskId, "reject")}
                      toneIndex={projects.findIndex((project) => project.id === item.task.projectId)}
                    />
                  ))
                )}
              </SortableContext>
            </Lane>
          </div>

          <aside className="ops-side-panel">
            <section className="panel">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                    Approval desk
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Needs decision</h2>
                </div>
                <span className="ops-count-pill">{approvals.length}</span>
              </div>
              <div className="mt-5 space-y-3">
                {approvals.length === 0 ? (
                  <div className="ops-empty-state">Nothing is waiting for approval.</div>
                ) : (
                  approvals.map((item) => (
                    <div key={item.id} className="ops-side-card">
                      <p className="font-semibold">{item.task.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {item.task.projectName} · {item.assignedToName || "Unassigned"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="panel">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                    Attention
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">Blocked & forgotten</h2>
                </div>
                <span className="ops-count-pill">{blockedItems.length + forgottenTasks.length}</span>
              </div>
              <div className="mt-5 space-y-3">
                {blockedItems.map((item) => (
                  <div key={item.id} className="ops-side-card">
                    <p className="font-semibold">{item.task.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      Blocked in {item.task.projectName}
                    </p>
                  </div>
                ))}
                {forgottenTasks.map(({ projectCode, projectId, projectName, task }) => (
                  <Link className="ops-side-card block" href={`/app/projects/${projectId}`} key={task.id}>
                    <p className="font-semibold">{task.title}</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {projectCode} · {projectName} · {formatDate(task.dueDate)}
                    </p>
                  </Link>
                ))}
                {blockedItems.length === 0 && forgottenTasks.length === 0 && (
                  <div className="ops-empty-state">No forgotten or blocked work right now.</div>
                )}
              </div>
            </section>

            {(savingLabel || errorMessage) && (
              <section className="panel">
                <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                  Live state
                </p>
                {savingLabel && (
                  <p className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {savingLabel}
                  </p>
                )}
                {errorMessage && (
                  <p className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                  </p>
                )}
              </section>
            )}
          </aside>
        </section>

        <DragOverlay>
          {overlayTask && selectedProject ? (
            <ProjectTaskCard
              task={overlayTask}
              toneIndex={projects.findIndex((project) => project.id === selectedProject.id)}
            />
          ) : overlayQueue ? (
            <QueueTaskCard
              canManage={false}
              item={overlayQueue}
              onApprove={() => {}}
              onQuickState={() => {}}
              onReject={() => {}}
              toneIndex={projects.findIndex((project) => project.id === overlayQueue.task.projectId)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </main>
  );
}
