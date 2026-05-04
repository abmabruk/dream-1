"use client";

/**
 * QuotesPanel — order detail tab. Lists every QuoteCard (newest version
 * first), opens the active quote inline below the list, and provides a
 * "+ عرض سعر جديد" action which posts an empty draft and selects it.
 *
 * Lives in the order page; gated end-to-end by the `quotes:*` permission
 * family. Customer never sees this — internal only.
 */

import { useCallback, useEffect, useState } from "react";

import { EmptyState, useToast } from "@/components/ui";

import { QuoteCard, type QuoteCardData } from "./quote-card";
import { QuoteForm } from "./quote-form";

interface QuotesPanelProps {
  orderId: string;
  canManageQuotes: boolean;
  canApproveQuotes: boolean;
  canCancelQuotes: boolean;
}

export function QuotesPanel({
  orderId,
  canManageQuotes,
  canApproveQuotes,
  canCancelQuotes,
}: QuotesPanelProps) {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<QuoteCardData[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/orders/${orderId}/quotes`, {
        cache: "no-store",
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        toast(json?.error?.message ?? "تعذّر تحميل عروض الأسعار", "error");
        return;
      }
      const list = (json.data as QuoteCardData[]).slice().sort(
        (a, b) => b.version - a.version,
      );
      setQuotes(list);
      setActiveId((cur) => {
        if (cur && list.some((q) => q.id === cur)) return cur;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  }, [orderId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      const r = await fetch(`/api/v1/orders/${orderId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        toast(json?.error?.message ?? "تعذّر إنشاء عرض سعر", "error");
        return;
      }
      const newId = (json.data as { id: string }).id;
      toast("تم إنشاء عرض سعر جديد", "success");
      await load();
      setActiveId(newId);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
    } finally {
      setCreating(false);
    }
  }, [orderId, toast, load]);

  const handleDeleted = useCallback(async () => {
    setActiveId(null);
    await load();
  }, [load]);

  return (
    <section className="panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
            عروض السعر
          </p>
          <h2 className="mt-2 text-2xl font-semibold">إدارة عروض السعر</h2>
        </div>
        {canManageQuotes ? (
          <button
            type="button"
            className="button-primary text-sm"
            onClick={handleCreate}
            disabled={creating || loading}
          >
            {creating ? "جاري الإنشاء…" : "+ عرض سعر جديد"}
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <div className="h-16 w-full animate-pulse rounded-xl bg-[var(--panel-strong)]" />
          <div className="h-16 w-full animate-pulse rounded-xl bg-[var(--panel-strong)]" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            heading="لا يوجد عرض سعر بعد"
            description="أنشئ عرض سعر داخلي للطلب لتتبّع الإصدارات والاعتماد."
            action={
              canManageQuotes ? (
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleCreate}
                  disabled={creating}
                >
                  {creating ? "جاري الإنشاء…" : "+ عرض سعر جديد"}
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[20rem_1fr]">
          <div className="space-y-2">
            {quotes.map((q) => (
              <QuoteCard
                key={q.id}
                quote={q}
                selected={q.id === activeId}
                onSelect={setActiveId}
              />
            ))}
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
            {activeId ? (
              <QuoteForm
                key={activeId}
                quoteId={activeId}
                canManageQuotes={canManageQuotes}
                canApproveQuotes={canApproveQuotes}
                canCancelQuotes={canCancelQuotes}
                onChanged={load}
                onDeleted={handleDeleted}
              />
            ) : (
              <p className="text-sm text-[var(--muted-foreground)]">
                اختر إصداراً من القائمة لعرض التفاصيل.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default QuotesPanel;
