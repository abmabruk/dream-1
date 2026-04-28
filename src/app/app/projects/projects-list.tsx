"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useToast } from "@/components/ui";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/modules/projects/project-status";

type ProjectRow = {
  id: string;
  code: string;
  name: string;
  status: keyof typeof PROJECT_STATUS_LABELS;
  priority: keyof typeof PROJECT_PRIORITY_LABELS;
  ownerName: string | null;
  orderCode: string | null;
  openTaskCount: number;
  queuedTodayCount: number;
  dueDate: string | null;
  doneTaskCount: number;
  totalTaskCount: number;
};

function formatDate(value: string | null) {
  if (!value) return "لا يوجد تاريخ استحقاق";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="space-y-1">
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-[var(--border)]"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? "#10b981" : "#14b8a6",
          }}
        />
      </div>
      <p className="text-[0.65rem] text-[var(--muted-foreground)]">
        {done}/{total} · {pct}%
      </p>
    </div>
  );
}

function GripIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

export function ProjectsList({
  initialProjects,
  canManage,
}: {
  initialProjects: ProjectRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState(initialProjects);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Re-sync from server-fetched props if they change (e.g. after revalidation).
  useEffect(() => {
    setItems(initialProjects);
  }, [initialProjects]);

  async function persistOrder(orderedIds: string[]) {
    try {
      const res = await fetch("/api/v1/projects/reorder", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast("✓ تم تحديث الترتيب", "success");
      router.refresh();
    } catch {
      toast("تعذّر حفظ الترتيب", "error");
      // Revert UI to server state
      setItems(initialProjects);
    }
  }

  function moveItem(id: string, direction: "up" | "down") {
    const idx = items.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
    void persistOrder(next.map((p) => p.id));
  }

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
    setDraggingId(id);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverId(null);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== id) setOverId(id);
  }

  function handleDrop(e: React.DragEvent, dropTargetId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === dropTargetId) {
      setDraggingId(null);
      setOverId(null);
      return;
    }
    const fromIdx = items.findIndex((p) => p.id === draggingId);
    const toIdx = items.findIndex((p) => p.id === dropTargetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...items];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setItems(next);
    setDraggingId(null);
    setOverId(null);
    void persistOrder(next.map((p) => p.id));
  }

  return (
    <>
      {/* Mobile: stacked card list */}
      <ul className="mt-4 flex flex-col gap-3 md:hidden">
        {items.map((project, idx) => (
          <li
            key={project.id}
            className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4 transition-shadow"
            style={{
              opacity: draggingId === project.id ? 0.4 : 1,
              outline:
                overId === project.id && draggingId !== project.id
                  ? "2px dashed var(--accent)"
                  : undefined,
              outlineOffset: "-2px",
            }}
            draggable={canManage}
            onDragStart={(e) => handleDragStart(e, project.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, project.id)}
            onDrop={(e) => handleDrop(e, project.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {canManage && (
                  <span className="text-[var(--muted-foreground)]" aria-hidden>
                    <GripIcon />
                  </span>
                )}
                <Link
                  className="font-semibold hover:underline"
                  href={`/app/projects/${project.id}`}
                >
                  {project.code} · {project.name}
                </Link>
              </div>
              <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--panel)] px-2 py-0.5 text-[0.7rem] text-[var(--muted-foreground)]">
                {PROJECT_STATUS_LABELS[project.status]}
              </span>
            </div>
            {project.orderCode && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                مرتبط بـ {project.orderCode}
              </p>
            )}
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
              <div>
                <dt className="text-[var(--muted-foreground)]">الأولوية</dt>
                <dd className="font-medium">
                  {PROJECT_PRIORITY_LABELS[project.priority]}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted-foreground)]">المالك</dt>
                <dd className="font-medium">
                  {project.ownerName || "غير مسند"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted-foreground)]">مهام مفتوحة</dt>
                <dd className="font-medium">{project.openTaskCount}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted-foreground)]">اليوم</dt>
                <dd className="font-medium">{project.queuedTodayCount}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[var(--muted-foreground)]">الاستحقاق</dt>
                <dd className="font-medium">{formatDate(project.dueDate)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[var(--muted-foreground)]">التقدّم</dt>
                <dd className="mt-1">
                  <ProgressBar
                    done={project.doneTaskCount}
                    total={project.totalTaskCount}
                  />
                </dd>
              </div>
            </dl>
            {canManage && (
              <div className="mt-3 flex items-center justify-end gap-1">
                <button
                  type="button"
                  className="min-h-[36px] min-w-[36px] rounded-full border border-[var(--border)] bg-[var(--panel)] text-sm disabled:opacity-30"
                  aria-label="نقل للأعلى"
                  disabled={idx === 0}
                  onClick={() => moveItem(project.id, "up")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="min-h-[36px] min-w-[36px] rounded-full border border-[var(--border)] bg-[var(--panel)] text-sm disabled:opacity-30"
                  aria-label="نقل للأسفل"
                  disabled={idx === items.length - 1}
                  onClick={() => moveItem(project.id, "down")}
                >
                  ↓
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Desktop / tablet: drag-and-drop table */}
      <div className="mt-4 hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="text-[var(--muted-foreground)]">
            <tr className="border-b border-[var(--border)]">
              {canManage && <th className="w-8 py-3 pr-2"></th>}
              <th className="py-3 pr-4 font-medium">المشروع</th>
              <th className="px-4 py-3 font-medium">الحالة</th>
              <th className="px-4 py-3 font-medium">الأولوية</th>
              <th className="px-4 py-3 font-medium">المالك</th>
              <th className="px-4 py-3 font-medium">المهام المفتوحة</th>
              <th className="px-4 py-3 font-medium">اليوم</th>
              <th className="px-4 py-3 font-medium">الاستحقاق</th>
              <th className="px-4 py-3 font-medium">التقدّم</th>
              {canManage && <th className="w-20 px-4 py-3 font-medium">ترتيب</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((project, idx) => (
              <tr
                key={project.id}
                className="border-b border-[var(--border)] last:border-b-0 transition-colors"
                draggable={canManage}
                onDragStart={(e) => handleDragStart(e, project.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, project.id)}
                onDrop={(e) => handleDrop(e, project.id)}
                style={{
                  opacity: draggingId === project.id ? 0.4 : 1,
                  background:
                    overId === project.id && draggingId !== project.id
                      ? "color-mix(in srgb, var(--accent) 6%, transparent)"
                      : undefined,
                  cursor: canManage ? (draggingId === project.id ? "grabbing" : "grab") : undefined,
                }}
              >
                {canManage && (
                  <td className="py-4 pr-2 text-[var(--muted-foreground)]">
                    <GripIcon />
                  </td>
                )}
                <td className="py-4 pr-4">
                  <Link
                    className="font-medium hover:underline"
                    href={`/app/projects/${project.id}`}
                  >
                    {project.code} · {project.name}
                  </Link>
                  {project.orderCode && (
                    <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                      مرتبط بـ {project.orderCode}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4">
                  {PROJECT_STATUS_LABELS[project.status]}
                </td>
                <td className="px-4 py-4">
                  {PROJECT_PRIORITY_LABELS[project.priority]}
                </td>
                <td className="px-4 py-4">{project.ownerName || "غير مسند"}</td>
                <td className="px-4 py-4">{project.openTaskCount}</td>
                <td className="px-4 py-4">{project.queuedTodayCount}</td>
                <td className="px-4 py-4">{formatDate(project.dueDate)}</td>
                <td className="px-4 py-4 min-w-[120px]">
                  <ProgressBar
                    done={project.doneTaskCount}
                    total={project.totalTaskCount}
                  />
                </td>
                {canManage && (
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="h-7 w-7 rounded-full border border-[var(--border)] bg-[var(--panel)] text-xs disabled:opacity-30 hover:bg-[var(--surface-subtle)]"
                        aria-label="نقل للأعلى"
                        disabled={idx === 0}
                        onClick={() => moveItem(project.id, "up")}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="h-7 w-7 rounded-full border border-[var(--border)] bg-[var(--panel)] text-xs disabled:opacity-30 hover:bg-[var(--surface-subtle)]"
                        aria-label="نقل للأسفل"
                        disabled={idx === items.length - 1}
                        onClick={() => moveItem(project.id, "down")}
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
