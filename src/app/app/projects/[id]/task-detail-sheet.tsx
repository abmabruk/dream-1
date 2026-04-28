"use client";

/**
 * TaskDetailSheet — Phase 6 (Memory Features).
 *
 * Opens as a `<BottomSheet>` from the Project Hub when a TaskCard is clicked.
 * Shows task header, description, comments thread (with @mention parsing
 * and a basic suggestion dropdown), and attachments grid (image previews +
 * file rows). Supports drag-and-drop and paste-image upload.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  BottomSheet,
  EmptyState,
  PriorityDot,
  StatusPill,
  useToast,
} from "@/components/ui";
import type { ProjectDetail } from "@/modules/projects/project.schemas";
import type { AttachmentListItem } from "@/modules/memory/attachment.schemas";
import type { CommentListItem } from "@/modules/memory/comment.schemas";

type FactoryUser = { id: string; firstName: string; displayName: string };

interface TaskDetailSheetProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  task: ProjectDetail["tasks"][number] | null;
  factoryUsers: FactoryUser[];
  currentUserId: string;
  canManage: boolean;
}

function fmtRelative(iso: string): string {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 30) return `منذ ${d} يوم`;
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(iso));
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} ب`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Highlights @mentions in the comment body. Tokens that match a known
 * factory firstName are styled as accent; others render as plain text.
 */
function renderBodyWithMentions(
  body: string,
  knownFirstNames: Set<string>,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(^|\s)@([\p{L}\p{N}_.-]+)/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(body)) !== null) {
    const start = m.index + m[1].length;
    const end = start + 1 + m[2].length;
    if (start > last) out.push(body.slice(last, start));
    const isKnown = knownFirstNames.has(m[2].toLowerCase());
    out.push(
      <span
        key={`mn-${key++}`}
        className={
          isKnown
            ? "rounded px-1 font-medium"
            : "rounded px-1 text-[var(--muted-foreground)]"
        }
        style={
          isKnown
            ? {
                background: "var(--tone-in-progress-bg)",
                color: "var(--tone-in-progress-fg)",
              }
            : undefined
        }
      >
        @{m[2]}
      </span>,
    );
    last = end;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

export function TaskDetailSheet({
  open,
  onClose,
  projectId,
  task,
  factoryUsers,
  currentUserId,
  canManage,
}: TaskDetailSheetProps) {
  const { toast } = useToast();
  const [comments, setComments] = useState<CommentListItem[]>([]);
  const [attachments, setAttachments] = useState<AttachmentListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [lightbox, setLightbox] = useState<AttachmentListItem | null>(null);
  const [suggestState, setSuggestState] = useState<{
    visible: boolean;
    query: string;
    anchorIndex: number;
  }>({ visible: false, query: "", anchorIndex: -1 });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskId = task?.id ?? null;

  const knownFirstNames = useMemo(() => {
    const s = new Set<string>();
    for (const u of factoryUsers) s.add(u.firstName.toLowerCase());
    return s;
  }, [factoryUsers]);

  const filteredSuggestions = useMemo(() => {
    if (!suggestState.visible) return [] as FactoryUser[];
    const q = suggestState.query.toLowerCase();
    return factoryUsers
      .filter((u) => u.firstName.toLowerCase().startsWith(q))
      .slice(0, 6);
  }, [factoryUsers, suggestState]);

  const refresh = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const [cRes, aRes] = await Promise.all([
        fetch(`/api/v1/projects/${projectId}/tasks/${taskId}/comments`, {
          cache: "no-store",
        }),
        fetch(`/api/v1/projects/${projectId}/tasks/${taskId}/attachments`, {
          cache: "no-store",
        }),
      ]);
      const cJson = await cRes.json().catch(() => null);
      const aJson = await aRes.json().catch(() => null);
      if (cJson?.ok) setComments(cJson.data.comments as CommentListItem[]);
      if (aJson?.ok)
        setAttachments(aJson.data.attachments as AttachmentListItem[]);
    } catch {
      toast("تعذّر تحميل التفاصيل", "error");
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId, toast]);

  useEffect(() => {
    if (open && taskId) {
      void refresh();
      setBody("");
    }
  }, [open, taskId, refresh]);

  const handleBodyChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      setBody(v);
      const pos = e.target.selectionStart ?? v.length;
      const upTo = v.slice(0, pos);
      const m = /(^|\s)@([\p{L}\p{N}_.-]*)$/u.exec(upTo);
      if (m) {
        setSuggestState({
          visible: true,
          query: m[2] ?? "",
          anchorIndex: pos - (m[2]?.length ?? 0) - 1, // position of '@'
        });
      } else if (suggestState.visible) {
        setSuggestState({ visible: false, query: "", anchorIndex: -1 });
      }
    },
    [suggestState.visible],
  );

  const insertMention = useCallback(
    (firstName: string) => {
      if (suggestState.anchorIndex < 0) return;
      const before = body.slice(0, suggestState.anchorIndex);
      const after = body.slice(
        suggestState.anchorIndex + 1 + suggestState.query.length,
      );
      const next = `${before}@${firstName} ${after}`;
      setBody(next);
      setSuggestState({ visible: false, query: "", anchorIndex: -1 });
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        const newCaret = before.length + firstName.length + 2;
        el.focus();
        el.setSelectionRange(newCaret, newCaret);
      });
    },
    [body, suggestState],
  );

  const submitComment = useCallback(async () => {
    if (!taskId || !body.trim()) return;
    setPosting(true);
    try {
      const r = await fetch(
        `/api/v1/projects/${projectId}/tasks/${taskId}/comments`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body: body.trim() }),
        },
      );
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.ok) {
        toast(json?.error?.message ?? "تعذّر إرسال التعليق", "error");
        return;
      }
      setBody("");
      setComments((cs) => [...cs, json.data.comment as CommentListItem]);
      toast("✓ أُضيف التعليق", "success");
    } catch {
      toast("خطأ في الاتصال", "error");
    } finally {
      setPosting(false);
    }
  }, [body, projectId, taskId, toast]);

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!confirm("حذف هذا التعليق؟")) return;
      try {
        const r = await fetch(`/api/v1/comments/${commentId}`, {
          method: "DELETE",
        });
        const json = await r.json().catch(() => null);
        if (!r.ok || !json?.ok) {
          toast(json?.error?.message ?? "تعذّر الحذف", "error");
          return;
        }
        setComments((cs) => cs.filter((c) => c.id !== commentId));
        toast("✓ حُذف التعليق", "success");
      } catch {
        toast("خطأ في الاتصال", "error");
      }
    },
    [toast],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!taskId) return;
      const list = Array.from(files);
      if (list.length === 0) return;
      setUploading(true);
      try {
        for (const file of list) {
          const fd = new FormData();
          fd.set("file", file);
          const r = await fetch(
            `/api/v1/projects/${projectId}/tasks/${taskId}/attachments`,
            { method: "POST", body: fd },
          );
          const json = await r.json().catch(() => null);
          if (!r.ok || !json?.ok) {
            toast(
              json?.error?.message ?? `تعذّر رفع ${file.name}`,
              "error",
            );
            continue;
          }
          setAttachments((a) => [
            ...a,
            json.data.attachment as AttachmentListItem,
          ]);
        }
        toast("✓ تم الرفع", "success");
      } finally {
        setUploading(false);
      }
    },
    [projectId, taskId, toast],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) void uploadFiles(files);
    },
    [uploadFiles],
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file") {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        void uploadFiles(files);
      }
    },
    [uploadFiles],
  );

  const deleteAttachment = useCallback(
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
        setAttachments((a) => a.filter((x) => x.id !== id));
        toast("✓ حُذف المرفق", "success");
      } catch {
        toast("خطأ في الاتصال", "error");
      }
    },
    [toast],
  );

  const onSubmitKey = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void submitComment();
      }
    },
    [submitComment],
  );

  if (!task) {
    return (
      <BottomSheet open={open} onClose={onClose} title="تفاصيل المهمة" desktopWidth={640}>
        <p className="text-sm text-[var(--muted-foreground)]">جاري التحميل…</p>
      </BottomSheet>
    );
  }

  const imageAttachments = attachments.filter((a) => a.isImage);
  const fileAttachments = attachments.filter((a) => !a.isImage);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <PriorityDot priority={task.priority} />
          <span>{task.title}</span>
        </span>
      }
      desktopWidth={720}
    >
      <div onPaste={onPaste} className="space-y-6">
        {/* Header */}
        <section className="flex flex-wrap items-center gap-3 text-sm">
          <StatusPill status={task.status} />
          {task.dueDate ? (
            <span className="text-[var(--muted-foreground)]">
              الاستحقاق: {fmtDate(task.dueDate)}
            </span>
          ) : null}
          {task.assignedToName ? (
            <span className="text-[var(--muted-foreground)]">
              المسند: {task.assignedToName}
            </span>
          ) : null}
        </section>

        {task.description ? (
          <section>
            <p className="text-sm leading-7 text-[var(--foreground)] whitespace-pre-wrap">
              {task.description}
            </p>
          </section>
        ) : null}

        {/* Attachments */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">المرفقات</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="button-secondary text-xs"
                disabled={uploading}
              >
                {uploading ? "جاري الرفع…" : "+ مرفق"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) void uploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            className={`rounded-2xl border-2 border-dashed p-3 text-center text-xs transition ${
              dragActive
                ? "border-[var(--accent)] bg-[var(--tone-in-progress-bg)]"
                : "border-[var(--border)] text-[var(--muted-foreground)]"
            }`}
          >
            اسحب الملفات هنا أو الصق صورة من الحافظة (10 م.ب كحد أقصى للملف)
          </div>

          {imageAttachments.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {imageAttachments.map((a) => {
                const canDelete =
                  canManage || a.uploadedById === currentUserId;
                return (
                  <div
                    key={a.id}
                    className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
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
                        onClick={() => deleteAttachment(a.id)}
                        className="absolute top-1 left-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                      >
                        حذف
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          {fileAttachments.length > 0 ? (
            <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
              {fileAttachments.map((a) => {
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
                        onClick={() => deleteAttachment(a.id)}
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

          {!loading &&
          imageAttachments.length === 0 &&
          fileAttachments.length === 0 ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              لا توجد مرفقات بعد.
            </p>
          ) : null}
        </section>

        {/* Comments */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">التعليقات</h3>
          {loading ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              جاري التحميل…
            </p>
          ) : comments.length === 0 ? (
            <EmptyState
              heading="لا تعليقات بعد"
              description="ابدأ المحادثة. اذكر زميلاً بـ @الاسم لإشعاره."
            />
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => {
                const canDelete =
                  canManage || c.authorId === currentUserId;
                return (
                  <li
                    key={c.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
                      <span>
                        <span className="font-medium text-[var(--foreground)]">
                          {c.authorName ?? "مجهول"}
                        </span>
                        {" · "}
                        {fmtRelative(c.createdAt)}
                      </span>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => deleteComment(c.id)}
                          className="text-[var(--tone-blocked-fg)] hover:underline"
                        >
                          حذف
                        </button>
                      ) : null}
                    </div>
                    <p className="text-sm leading-7 whitespace-pre-wrap">
                      {renderBodyWithMentions(c.body, knownFirstNames)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="relative">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={handleBodyChange}
              onKeyDown={onSubmitKey}
              placeholder="اكتب تعليقاً… استخدم @ لذكر زميل"
              rows={3}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3 text-sm focus:border-[var(--accent)] focus:outline-none"
            />
            {suggestState.visible && filteredSuggestions.length > 0 ? (
              <ul className="absolute z-10 mt-1 max-h-44 w-60 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] shadow-lg">
                {filteredSuggestions.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => insertMention(u.firstName)}
                      className="block w-full px-3 py-1.5 text-right text-sm hover:bg-[var(--background)]"
                    >
                      <span className="font-medium">@{u.firstName}</span>
                      <span className="ms-2 text-xs text-[var(--muted-foreground)]">
                        {u.displayName}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] text-[var(--muted-foreground)]">
                Ctrl/Cmd + Enter للإرسال
              </span>
              <button
                type="button"
                onClick={() => void submitComment()}
                disabled={!body.trim() || posting}
                className="button-primary text-sm"
              >
                {posting ? "إرسال…" : "إرسال"}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Lightbox */}
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
    </BottomSheet>
  );
}
