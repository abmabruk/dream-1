"use client";

/**
 * FilesGalleryPanel — Phase 6 Files tab.
 *
 * Lists every attachment across all tasks in the project, grouped by task.
 * Image attachments render as thumbnails; PDFs as file rows. Clicking the
 * task title opens the TaskDetailSheet (via the parent).
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState, useToast } from "@/components/ui";
import type { AttachmentListItem } from "@/modules/memory/attachment.schemas";

interface ProjectAttachment extends AttachmentListItem {
  taskTitle: string;
}

interface FilesGalleryPanelProps {
  projectId: string;
  tasks: { id: string; title: string }[];
  currentUserId: string;
  canManage: boolean;
  onOpenTask: (taskId: string) => void;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ب`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

export function FilesGalleryPanel({
  projectId,
  tasks,
  currentUserId,
  canManage,
  onOpenTask,
}: FilesGalleryPanelProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<ProjectAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<ProjectAttachment | null>(null);

  const taskTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of tasks) m.set(t.id, t.title);
    return m;
  }, [tasks]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/projects/${projectId}/attachments`, {
        cache: "no-store",
      });
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) {
        toast(json?.error?.message ?? "تعذّر تحميل الملفات", "error");
        return;
      }
      setItems(json.data.attachments as ProjectAttachment[]);
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("حذف هذا المرفق؟")) return;
      try {
        const r = await fetch(`/api/v1/attachments/${id}`, {
          method: "DELETE",
        });
        const json = await r.json().catch(() => null);
        if (!r.ok || !json?.ok) {
          toast(json?.error?.message ?? "تعذّر الحذف", "error");
          return;
        }
        setItems((xs) => xs.filter((x) => x.id !== id));
        toast("✓ حُذف المرفق", "success");
      } catch {
        toast("خطأ في الاتصال", "error");
      }
    },
    [toast],
  );

  // Group by task
  const groups = useMemo(() => {
    const m = new Map<string, ProjectAttachment[]>();
    for (const it of items) {
      const arr = m.get(it.taskId);
      if (arr) arr.push(it);
      else m.set(it.taskId, [it]);
    }
    return Array.from(m.entries());
  }, [items]);

  if (loading) {
    return (
      <div className="panel">
        <p className="text-sm text-[var(--muted-foreground)]">جاري التحميل…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        heading="لا توجد ملفات بعد"
        description="ارفع صوراً أو ملفات PDF من بطاقة أي مهمة لتظهر هنا."
      />
    );
  }

  return (
    <section className="space-y-6">
      {groups.map(([taskId, group]) => {
        const title = taskTitleById.get(taskId) ?? group[0].taskTitle ?? "مهمة";
        return (
          <div
            key={taskId}
            className="panel space-y-3"
          >
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => onOpenTask(taskId)}
                className="text-sm font-semibold text-[var(--accent)] hover:underline"
              >
                {title}
              </button>
              <span className="text-xs text-[var(--muted-foreground)]">
                {group.length} مرفق
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {group
                .filter((a) => a.isImage)
                .map((a) => {
                  const canDelete =
                    canManage || a.uploadedById === currentUserId;
                  return (
                    <div
                      key={a.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel-strong)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.url}
                        alt={a.filename}
                        className="size-full cursor-zoom-in object-cover"
                        onClick={() => setLightbox(a)}
                      />
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(a.id)}
                          className="absolute top-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                        >
                          حذف
                        </button>
                      ) : null}
                    </div>
                  );
                })}
            </div>
            {group.some((a) => !a.isImage) ? (
              <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
                {group
                  .filter((a) => !a.isImage)
                  .map((a) => {
                    const canDelete =
                      canManage || a.uploadedById === currentUserId;
                    return (
                      <li
                        key={a.id}
                        className="flex items-center gap-3 px-3 py-2 text-sm"
                      >
                        <span className="text-lg" aria-hidden>
                          📄
                        </span>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 truncate text-[var(--accent)] hover:underline"
                        >
                          {a.filename}
                        </a>
                        <span className="text-xs text-[var(--muted-foreground)]">
                          {fmtSize(a.sizeBytes)}
                        </span>
                        {canDelete ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(a.id)}
                            className="text-xs text-[var(--tone-blocked-fg)] hover:underline"
                          >
                            حذف
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
              </ul>
            ) : null}
          </div>
        );
      })}

      {lightbox ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.filename}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />
        </div>
      ) : null}
    </section>
  );
}
