"use client";

/**
 * AddProjectDialog — opens a "New project" form. Phase 7 wraps it in a
 * `<BottomSheet>` on mobile so it sits comfortably above the keyboard;
 * desktop continues to use the original centered Grid-Commander dialog.
 */

import { useState } from "react";
import { BottomSheet } from "@/components/ui";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { PROJECT_PRIORITY_LABELS } from "@/modules/projects/project-status";
import { post } from "../shared";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function AddProjectDialog({
  onClose,
  onRefresh,
}: {
  onClose: () => void;
  onRefresh: () => void;
}) {
  const isMobile = useIsMobile();
  const [name, setName] = useState("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 3) {
      setError("يجب أن يكون الاسم 3 أحرف على الأقل.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await post("/api/v1/projects", {
        name: name.trim(),
        priority,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(startDate ? { startDate } : {}),
        ...(dueDate ? { dueDate } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onRefresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "فشل إنشاء المشروع.");
    } finally {
      setSaving(false);
    }
  }

  const formBody = (
    <form onSubmit={handleSubmit} className={isMobile ? "space-y-3" : "gc-form"}>
      {isMobile ? (
        <>
          <label className="block text-sm">
            الاسم *
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المشروع (3 أحرف على الأقل)"
              autoFocus
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
              style={{ borderColor: "var(--border)" }}
            />
          </label>

          <div>
            <p className="text-sm mb-1">الأولوية</p>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className="rounded-full border px-3 py-2 text-xs min-h-[44px]"
                  style={{
                    borderColor:
                      priority === p ? "var(--accent)" : "var(--border)",
                    background:
                      priority === p ? "var(--accent)" : "var(--panel-strong)",
                    color:
                      priority === p
                        ? "var(--accent-foreground)"
                        : "var(--foreground)",
                  }}
                >
                  {PROJECT_PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            الوصف
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف اختياري"
              rows={2}
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              تاريخ البدء
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
                style={{ borderColor: "var(--border)" }}
              />
            </label>
            <label className="block text-sm">
              تاريخ الاستحقاق
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm min-h-[44px]"
                style={{ borderColor: "var(--border)" }}
              />
            </label>
          </div>

          <label className="block text-sm">
            ملاحظات
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات اختيارية"
              rows={2}
              className="mt-1 w-full rounded-xl border bg-[var(--panel-strong)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)" }}
            />
          </label>

          {error && (
            <p className="text-sm text-[var(--tone-blocked-fg)]">{error}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-sm text-[var(--muted-foreground)] hover:bg-[var(--panel-strong)] min-h-[44px]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="button-primary text-sm min-h-[44px] disabled:opacity-60"
              disabled={saving}
            >
              {saving ? "جارٍ الحفظ..." : "إنشاء مشروع"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="gc-form-field">
            <label className="gc-form-label">الاسم *</label>
            <input
              className="gc-form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المشروع (3 أحرف على الأقل)"
              autoFocus
            />
          </div>
          <div className="gc-form-field">
            <label className="gc-form-label">الأولوية</label>
            <div className="gc-form-priority-row">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`gc-form-priority-btn ${
                    priority === p ? "gc-form-priority-active" : ""
                  }`}
                  onClick={() => setPriority(p)}
                >
                  {PROJECT_PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div className="gc-form-field">
            <label className="gc-form-label">الوصف</label>
            <textarea
              className="gc-form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف اختياري"
              rows={2}
            />
          </div>
          <div className="gc-form-row">
            <div className="gc-form-field">
              <label className="gc-form-label">تاريخ البدء</label>
              <input
                className="gc-form-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="gc-form-field">
              <label className="gc-form-label">تاريخ الاستحقاق</label>
              <input
                className="gc-form-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="gc-form-field">
            <label className="gc-form-label">ملاحظات</label>
            <textarea
              className="gc-form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات اختيارية"
              rows={2}
            />
          </div>
          {error && <p className="gc-form-error">{error}</p>}
          <div className="gc-form-actions">
            <button
              type="button"
              className="gc-form-cancel-btn"
              onClick={onClose}
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="gc-form-submit-btn"
              disabled={saving}
            >
              {saving ? "جارٍ الحفظ..." : "إنشاء مشروع"}
            </button>
          </div>
        </>
      )}
    </form>
  );

  if (isMobile) {
    return (
      <BottomSheet open onClose={onClose} title="مشروع جديد">
        {formBody}
      </BottomSheet>
    );
  }

  return (
    <div className="gc-dialog-overlay" onClick={onClose}>
      <div className="gc-form-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="gc-form-dialog-header">
          <h2 className="gc-dialog-title">مشروع جديد</h2>
          <button className="gc-widget-btn" onClick={onClose} type="button">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {formBody}
      </div>
    </div>
  );
}
