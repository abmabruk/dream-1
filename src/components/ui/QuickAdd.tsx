"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useToast } from "./ToastProvider";
import { BottomSheet } from "./BottomSheet";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

export function QuickAdd() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "task" | "cost">("menu");

  // Hide outside /app/*
  if (!pathname?.startsWith("/app")) {
    return null;
  }

  function closeAll() {
    setOpen(false);
    setMode("menu");
  }

  return (
    <>
      <button
        type="button"
        aria-label="إضافة سريعة"
        onClick={() => {
          setMode("menu");
          setOpen((v) => !v);
        }}
        className="dream-fab fixed bottom-6 z-[200] inline-flex size-14 items-center justify-center rounded-full text-2xl font-bold shadow-[0_18px_36px_rgba(64,48,27,0.28)] transition-transform hover:scale-105 active:scale-95"
        style={{
          insetInlineEnd: "max(1.25rem, env(safe-area-inset-right, 0px))",
          background: "var(--accent)",
          color: "var(--accent-foreground)",
        }}
      >
        +
      </button>
      {open ? (
        isMobile ? (
          <BottomSheet
            open
            onClose={closeAll}
            title={
              mode === "menu"
                ? "إضافة سريعة"
                : mode === "task"
                  ? "مهمة جديدة"
                  : "تكلفة جديدة"
            }
          >
            {mode === "menu" ? (
              <QuickAddMenu
                onPickTask={() => setMode("task")}
                onPickCost={() => setMode("cost")}
                onPickProject={() => {
                  closeAll();
                  window.dispatchEvent(new CustomEvent("dream:add-project:open"));
                }}
                onSoon={(label) => {
                  toast(`${label} — قريباً`, "info");
                  closeAll();
                }}
              />
            ) : mode === "task" ? (
              <QuickAddTaskForm
                onClose={closeAll}
                onCreated={() => {
                  toast("✓ تم إنشاء المهمة", "success");
                  router.refresh();
                  closeAll();
                }}
                onError={(msg) => toast(msg, "error")}
              />
            ) : (
              <QuickAddCostForm
                onClose={closeAll}
                onCreated={() => {
                  toast("✓ أُضيفت التكلفة", "success");
                  router.refresh();
                  closeAll();
                }}
                onError={(msg) => toast(msg, "error")}
              />
            )}
          </BottomSheet>
        ) : (
          <div
            className="fixed inset-0 z-[210]"
            onClick={closeAll}
          >
            <div
              className="absolute z-[211]"
              style={{ insetInlineEnd: "1.5rem", bottom: "5.5rem" }}
              onClick={(e) => e.stopPropagation()}
            >
              {mode === "menu" ? (
                <QuickAddMenu
                  onPickTask={() => setMode("task")}
                  onPickCost={() => setMode("cost")}
                  onPickProject={() => {
                    closeAll();
                    window.dispatchEvent(new CustomEvent("dream:add-project:open"));
                  }}
                  onSoon={(label) => {
                    toast(`${label} — قريباً`, "info");
                    setOpen(false);
                  }}
                />
              ) : mode === "task" ? (
                <QuickAddTaskForm
                  onClose={closeAll}
                  onCreated={() => {
                    toast("✓ تم إنشاء المهمة", "success");
                    router.refresh();
                    closeAll();
                  }}
                  onError={(msg) => toast(msg, "error")}
                />
              ) : (
                <QuickAddCostForm
                  onClose={closeAll}
                  onCreated={() => {
                    toast("✓ أُضيفت التكلفة", "success");
                    router.refresh();
                    closeAll();
                  }}
                  onError={(msg) => toast(msg, "error")}
                />
              )}
            </div>
          </div>
        )
      ) : null}
    </>
  );
}

function QuickAddMenu({
  onPickTask,
  onPickProject,
  onPickCost,
  onSoon,
}: {
  onPickTask: () => void;
  onPickProject: () => void;
  onPickCost: () => void;
  onSoon: (label: string) => void;
}) {
  const items: { label: string; onClick: () => void }[] = [
    { label: "مهمة جديدة", onClick: onPickTask },
    { label: "مشروع جديد", onClick: onPickProject },
    { label: "تكلفة", onClick: onPickCost },
    { label: "ملاحظة", onClick: () => onSoon("ملاحظة") },
  ];
  return (
    <div
      className="rounded-2xl border bg-[var(--panel)] backdrop-blur-md p-2 shadow-[0_18px_50px_rgba(20,14,4,0.22)] min-w-[200px]"
      style={{ borderColor: "var(--border)" }}
    >
      {items.map((it) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onClick}
          className="block w-full rounded-xl px-3 py-3 text-start text-sm font-medium hover:bg-[var(--panel-strong)] text-[var(--foreground)] min-h-[44px]"
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function QuickAddTaskForm({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/projects");
        const json = await res.json();
        if (!alive) return;
        if (json.ok && Array.isArray(json.data)) {
          const opts: ProjectOption[] = json.data.map((p: { id: string; code: string; name: string }) => ({
            id: p.id,
            code: p.code,
            name: p.name,
          }));
          setProjects(opts);
          if (opts[0]) setProjectId(opts[0].id);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setTimeout(() => titleRef.current?.focus(), 30);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      onError("اختر مشروعاً أولاً");
      return;
    }
    if (title.trim().length < 3) {
      onError("اكتب عنوان مهمة (3 أحرف على الأقل)");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), priority: "MEDIUM" }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        onError(json?.error?.message ?? "فشل حفظ المهمة");
        return;
      }
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border bg-[var(--panel)] backdrop-blur-md p-3 shadow-[0_18px_50px_rgba(20,14,4,0.22)] min-w-[280px] flex flex-col gap-2"
      style={{ borderColor: "var(--border)" }}
      dir="rtl"
    >
      <p className="text-xs font-semibold text-[var(--muted-foreground)]">مهمة جديدة</p>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="rounded-xl border px-2 py-1.5 text-sm bg-[var(--panel-strong)]"
        style={{ borderColor: "var(--border)" }}
      >
        {projects.length === 0 ? <option value="">— لا توجد مشاريع —</option> : null}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.name}
          </option>
        ))}
      </select>
      <input
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="عنوان المهمة"
        className="rounded-xl border px-2 py-1.5 text-sm bg-[var(--panel-strong)] outline-none"
        style={{ borderColor: "var(--border)" }}
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--panel-strong)]"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "..." : "حفظ (Enter)"}
        </button>
      </div>
    </form>
  );
}

const COST_CATEGORIES = [
  { v: "MATERIAL", l: "مواد" },
  { v: "LABOR", l: "عمالة" },
  { v: "SERVICE", l: "خدمات" },
  { v: "OVERHEAD", l: "مصاريف عامة" },
  { v: "OTHER", l: "أخرى" },
] as const;

function QuickAddCostForm({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [category, setCategory] = useState<string>("MATERIAL");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/projects");
        const json = await res.json();
        if (!alive) return;
        if (json.ok && Array.isArray(json.data)) {
          const opts: ProjectOption[] = json.data.map(
            (p: { id: string; code: string; name: string }) => ({
              id: p.id,
              code: p.code,
              name: p.name,
            }),
          );
          setProjects(opts);
          if (opts[0]) setProjectId(opts[0].id);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setTimeout(() => amountRef.current?.focus(), 30);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      onError("اختر مشروعاً أولاً");
      return;
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      onError("اكتب مبلغًا صحيحًا أكبر من صفر");
      return;
    }
    if (description.trim().length < 2) {
      onError("اكتب وصفًا قصيرًا");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/costs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          amount: amt,
          description: description.trim(),
          incurredAt: new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        onError(json?.error?.message ?? "فشل حفظ التكلفة");
        return;
      }
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "فشل الاتصال");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border bg-[var(--panel)] backdrop-blur-md p-3 shadow-[0_18px_50px_rgba(20,14,4,0.22)] min-w-[280px] flex flex-col gap-2"
      style={{ borderColor: "var(--border)" }}
      dir="rtl"
    >
      <p className="text-xs font-semibold text-[var(--muted-foreground)]">تكلفة جديدة</p>
      <select
        value={projectId}
        onChange={(e) => setProjectId(e.target.value)}
        className="rounded-xl border px-2 py-1.5 text-sm bg-[var(--panel-strong)]"
        style={{ borderColor: "var(--border)" }}
      >
        {projects.length === 0 ? <option value="">— لا توجد مشاريع —</option> : null}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} · {p.name}
          </option>
        ))}
      </select>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="rounded-xl border px-2 py-1.5 text-sm bg-[var(--panel-strong)]"
        style={{ borderColor: "var(--border)" }}
      >
        {COST_CATEGORIES.map((c) => (
          <option key={c.v} value={c.v}>
            {c.l}
          </option>
        ))}
      </select>
      <input
        ref={amountRef}
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="المبلغ (ر.س)"
        className="rounded-xl border px-2 py-1.5 text-sm bg-[var(--panel-strong)] tabular-nums"
        style={{ borderColor: "var(--border)" }}
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="الوصف"
        className="rounded-xl border px-2 py-1.5 text-sm bg-[var(--panel-strong)]"
        style={{ borderColor: "var(--border)" }}
      />
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-[var(--muted-foreground)] hover:bg-[var(--panel-strong)]"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "..." : "حفظ"}
        </button>
      </div>
    </form>
  );
}

