"use client";

/**
 * QuoteForm — main editor for a single quote. Renders header (version +
 * status + action buttons), editable lines table (DRAFT only), pricing
 * summary, and notes section. The server is the source of truth for
 * totals — every meaningful edit issues a PATCH and re-renders from the
 * returned payload.
 *
 * Buttons are gated by `status × permission` per the Phase 2 plan:
 *   - DRAFT     → save / send / delete           (canManage)
 *   - SENT      → approve / reject (canApprove); duplicate (canManage)
 *   - APPROVED  → duplicate (canManage); cancel (canCancel)
 *   - other     → read-only
 *
 * NOTE: types are local because Agent B's `@/modules/quotes/quote.schemas`
 * is not yet committed. Once those schemas land, swap `QuoteDetail` /
 * `QuoteLine` for the imported types.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { StatusPill, useToast } from "@/components/ui";
import { formatSAR } from "@/lib/format";

import {
  QUOTE_STATUS_LABELS_AR,
  QUOTE_STATUS_TONE,
} from "./quote-card";

export interface QuoteLine {
  id: string;
  sortOrder: number;
  description: string;
  quantity: string | number;
  unitPrice: string | number;
  lineTotal: string | number;
}

export interface QuoteDetail {
  id: string;
  orderId: string;
  version: number;
  status: string;
  subtotal: string | number;
  discount: string | number | null;
  discountReason: string | null;
  taxRate: string | number;
  taxInclusive: boolean;
  taxAmount: string | number;
  total: string | number;
  notes: string | null;
  internalNotes: string | null;
  validUntil: string | null;
  lines: QuoteLine[];
}

interface QuoteFormProps {
  quoteId: string;
  canManageQuotes: boolean;
  canApproveQuotes: boolean;
  canCancelQuotes: boolean;
  /** Fired after any state-changing action so the panel can refetch. */
  onChanged: () => void | Promise<void>;
  /** Fired after a soft-delete so the panel can clear selection. */
  onDeleted: () => void | Promise<void>;
}

type LineDraft = {
  description: string;
  quantity: string;
  unitPrice: string;
  productId?: string | null;
};

const EMPTY_LINE: LineDraft = {
  description: "",
  quantity: "1",
  unitPrice: "0",
  productId: null,
};

// Local stub of the product-picker payload until
// `@/modules/products/product.schemas` lands.
type ProductPickerHit = {
  id: string;
  name: string;
  sku?: string | null;
  defaultUnitPrice?: string | number | null;
};

/**
 * Tiny self-contained autocomplete that hits `/api/v1/products/picker?q=...`
 * after the user types ≥2 chars. Falls back to nothing if the API errors.
 */
function ProductPicker({
  value,
  onChange,
  onPick,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (hit: ProductPickerHit) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<ProductPickerHit[]>([]);
  const debRef = useRef<number | null>(null);

  useEffect(() => {
    if (debRef.current) window.clearTimeout(debRef.current);
    const q = value.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    debRef.current = window.setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/v1/products/picker?q=${encodeURIComponent(q)}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const json = await r.json();
        if (!json?.ok) return;
        const data = (json.data ?? []) as ProductPickerHit[];
        setHits(data.slice(0, 8));
      } catch {
        // Silent — picker is optional.
      }
    }, 200);
    return () => {
      if (debRef.current) window.clearTimeout(debRef.current);
    };
  }, [value]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        disabled={disabled}
        className={className ?? "input w-full"}
      />
      {open && hits.length > 0 ? (
        <ul
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border bg-[var(--panel)] shadow-lg"
          style={{ borderColor: "var(--border)" }}
          role="listbox"
        >
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(h);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-[var(--panel-strong)]"
              >
                <span className="flex flex-col">
                  <span>{h.name}</span>
                  {h.sku ? (
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {h.sku}
                    </span>
                  ) : null}
                </span>
                {h.defaultUnitPrice !== null && h.defaultUnitPrice !== undefined ? (
                  <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
                    {String(h.defaultUnitPrice)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function QuoteForm({
  quoteId,
  canManageQuotes,
  canApproveQuotes,
  canCancelQuotes,
  onChanged,
  onDeleted,
}: QuoteFormProps) {
  const { toast } = useToast();
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [newLine, setNewLine] = useState<LineDraft>(EMPTY_LINE);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/quotes/${quoteId}`, { cache: "no-store" });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        toast(json?.error?.message ?? "تعذّر تحميل عرض السعر", "error");
        return;
      }
      setQuote(json.data as QuoteDetail);
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  }, [quoteId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const isDraft = quote?.status === "DRAFT";
  const isSent = quote?.status === "SENT";
  const isApproved = quote?.status === "APPROVED";

  // ---------- Mutations ----------

  const patchQuote = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!quote) return;
      setBusy("save");
      try {
        const r = await fetch(`/api/v1/quotes/${quote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = await r.json();
        if (!r.ok || !json.ok) {
          toast(json?.error?.message ?? "تعذّر الحفظ", "error");
          return;
        }
        setQuote(json.data as QuoteDetail);
        await onChanged();
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
      } finally {
        setBusy(null);
      }
    },
    [quote, toast, onChanged],
  );

  const action = useCallback(
    async (path: string, label: string, key: string) => {
      if (!quote) return;
      setBusy(key);
      try {
        const r = await fetch(`/api/v1/quotes/${quote.id}/${path}`, {
          method: "POST",
        });
        const json = await r.json();
        if (!r.ok || !json.ok) {
          toast(json?.error?.message ?? `تعذّر ${label}`, "error");
          return;
        }
        toast(`تم ${label}`, "success");
        await load();
        await onChanged();
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
      } finally {
        setBusy(null);
      }
    },
    [quote, toast, load, onChanged],
  );

  const handleDelete = useCallback(async () => {
    if (!quote) return;
    if (!confirm("هل تريد فعلاً حذف هذه المسودة؟")) return;
    setBusy("delete");
    try {
      const r = await fetch(`/api/v1/quotes/${quote.id}`, { method: "DELETE" });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        toast(json?.error?.message ?? "تعذّر الحذف", "error");
        return;
      }
      toast("تم حذف المسودة", "success");
      await onDeleted();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
    } finally {
      setBusy(null);
    }
  }, [quote, toast, onDeleted]);

  const handleAddLine = useCallback(async () => {
    if (!quote) return;
    if (!newLine.description.trim()) {
      toast("الوصف مطلوب", "error");
      return;
    }
    setBusy("addLine");
    try {
      const r = await fetch(`/api/v1/quotes/${quote.id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newLine.description,
          quantity: newLine.quantity,
          unitPrice: newLine.unitPrice,
          ...(newLine.productId ? { productId: newLine.productId } : {}),
        }),
      });
      const json = await r.json();
      if (!r.ok || !json.ok) {
        toast(json?.error?.message ?? "تعذّر إضافة البند", "error");
        return;
      }
      setNewLine(EMPTY_LINE);
      await load();
      await onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
    } finally {
      setBusy(null);
    }
  }, [quote, newLine, toast, load, onChanged]);

  const handleUpdateLine = useCallback(
    async (lineId: string, patch: Partial<QuoteLine>) => {
      if (!quote) return;
      setBusy(`line-${lineId}`);
      try {
        const r = await fetch(`/api/v1/quotes/${quote.id}/lines/${lineId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = await r.json();
        if (!r.ok || !json.ok) {
          toast(json?.error?.message ?? "تعذّر تحديث البند", "error");
          return;
        }
        await load();
        await onChanged();
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
      } finally {
        setBusy(null);
      }
    },
    [quote, toast, load, onChanged],
  );

  const handleDeleteLine = useCallback(
    async (lineId: string) => {
      if (!quote) return;
      if (!confirm("حذف هذا البند؟")) return;
      setBusy(`line-${lineId}`);
      try {
        const r = await fetch(`/api/v1/quotes/${quote.id}/lines/${lineId}`, {
          method: "DELETE",
        });
        const json = await r.json();
        if (!r.ok || !json.ok) {
          toast(json?.error?.message ?? "تعذّر الحذف", "error");
          return;
        }
        await load();
        await onChanged();
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
      } finally {
        setBusy(null);
      }
    },
    [quote, toast, load, onChanged],
  );

  // ---------- Render ----------

  if (loading || !quote) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-40 animate-pulse rounded-md bg-[var(--panel-strong)]" />
        <div className="h-32 w-full animate-pulse rounded-2xl bg-[var(--panel-strong)]" />
        <div className="h-24 w-full animate-pulse rounded-2xl bg-[var(--panel-strong)]" />
      </div>
    );
  }

  const validUntilValue = quote.validUntil
    ? quote.validUntil.slice(0, 10)
    : "";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">
            عرض السعر — الإصدار {quote.version}
          </h3>
          <StatusPill
            status={quote.status}
            label={QUOTE_STATUS_LABELS_AR[quote.status] ?? quote.status}
            tone={QUOTE_STATUS_TONE[quote.status]}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDraft && canManageQuotes ? (
            <>
              <button
                type="button"
                className="button-primary text-sm"
                onClick={() => action("send", "الإرسال", "send")}
                disabled={busy !== null}
              >
                {busy === "send" ? "جاري الإرسال…" : "إرسال داخلي"}
              </button>
              <button
                type="button"
                className="button-danger text-sm"
                onClick={handleDelete}
                disabled={busy !== null}
              >
                {busy === "delete" ? "جاري الحذف…" : "حذف"}
              </button>
            </>
          ) : null}
          {isSent && canApproveQuotes ? (
            <>
              <button
                type="button"
                className="button-primary text-sm"
                onClick={() => action("approve", "الاعتماد", "approve")}
                disabled={busy !== null}
              >
                {busy === "approve" ? "جاري الاعتماد…" : "اعتماد"}
              </button>
              <button
                type="button"
                className="button-danger text-sm"
                onClick={() => action("reject", "الرفض", "reject")}
                disabled={busy !== null}
              >
                {busy === "reject" ? "جاري الرفض…" : "رفض"}
              </button>
            </>
          ) : null}
          {(isSent || isApproved) && canManageQuotes ? (
            <button
              type="button"
              className="button-secondary text-sm"
              onClick={() => action("duplicate", "النسخ", "duplicate")}
              disabled={busy !== null}
            >
              {busy === "duplicate" ? "جاري النسخ…" : "نسخ كنسخة جديدة"}
            </button>
          ) : null}
          {isApproved && canCancelQuotes ? (
            <button
              type="button"
              className="button-danger text-sm"
              onClick={() => action("cancel", "الإلغاء", "cancel")}
              disabled={busy !== null}
            >
              {busy === "cancel" ? "جاري الإلغاء…" : "إلغاء"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Lines */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
        <h4 className="text-sm font-semibold">البنود</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-start text-xs uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                <th className="py-2 text-start">#</th>
                <th className="py-2 text-start">الوصف</th>
                <th className="py-2 text-end">الكمية</th>
                <th className="py-2 text-end">سعر الوحدة</th>
                <th className="py-2 text-end">الإجمالي</th>
                {isDraft && canManageQuotes ? (
                  <th className="py-2 text-end">إجراءات</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {quote.lines.length === 0 ? (
                <tr>
                  <td
                    colSpan={isDraft && canManageQuotes ? 6 : 5}
                    className="py-6 text-center text-sm text-[var(--muted-foreground)]"
                  >
                    لا توجد بنود بعد.
                  </td>
                </tr>
              ) : (
                quote.lines.map((line) => (
                  <tr
                    key={line.id}
                    className="border-t"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="py-2.5 tabular-nums text-[var(--muted-foreground)]">
                      {line.sortOrder + 1}
                    </td>
                    <td className="py-2.5">
                      {isDraft && canManageQuotes ? (
                        <input
                          type="text"
                          defaultValue={line.description}
                          className="input w-full"
                          onBlur={(e) => {
                            if (e.target.value !== line.description) {
                              void handleUpdateLine(line.id, {
                                description: e.target.value,
                              });
                            }
                          }}
                          disabled={busy !== null}
                        />
                      ) : (
                        line.description
                      )}
                    </td>
                    <td className="py-2.5 text-end tabular-nums">
                      {isDraft && canManageQuotes ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={String(line.quantity)}
                          className="input w-24 text-end"
                          onBlur={(e) => {
                            if (e.target.value !== String(line.quantity)) {
                              void handleUpdateLine(line.id, {
                                quantity: e.target.value,
                              });
                            }
                          }}
                          disabled={busy !== null}
                        />
                      ) : (
                        String(line.quantity)
                      )}
                    </td>
                    <td className="py-2.5 text-end tabular-nums">
                      {isDraft && canManageQuotes ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={String(line.unitPrice)}
                          className="input w-28 text-end"
                          onBlur={(e) => {
                            if (e.target.value !== String(line.unitPrice)) {
                              void handleUpdateLine(line.id, {
                                unitPrice: e.target.value,
                              });
                            }
                          }}
                          disabled={busy !== null}
                        />
                      ) : (
                        formatSAR(line.unitPrice)
                      )}
                    </td>
                    <td className="py-2.5 text-end font-semibold tabular-nums">
                      {formatSAR(line.lineTotal)}
                    </td>
                    {isDraft && canManageQuotes ? (
                      <td className="py-2.5 text-end">
                        <button
                          type="button"
                          className="button-danger text-xs"
                          style={{ height: "2rem", paddingInline: "0.75rem" }}
                          onClick={() => handleDeleteLine(line.id)}
                          disabled={busy !== null}
                          aria-label="حذف البند"
                        >
                          حذف
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {isDraft && canManageQuotes ? (
          <div className="mt-4 grid gap-2 rounded-xl border border-dashed border-[var(--border)] bg-[var(--panel-strong)] p-3 sm:grid-cols-[1fr_6rem_8rem_auto]">
            <ProductPicker
              placeholder="وصف البند (اكتب للبحث في الكتالوج)"
              className="input w-full"
              value={newLine.description}
              onChange={(v) =>
                setNewLine((p) => ({
                  ...p,
                  description: v,
                  productId: null,
                }))
              }
              onPick={(hit) =>
                setNewLine((p) => ({
                  ...p,
                  description: hit.name,
                  unitPrice:
                    hit.defaultUnitPrice !== null && hit.defaultUnitPrice !== undefined
                      ? String(hit.defaultUnitPrice)
                      : p.unitPrice,
                  productId: hit.id,
                }))
              }
              disabled={busy !== null}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="الكمية"
              className="input text-end"
              value={newLine.quantity}
              onChange={(e) =>
                setNewLine((p) => ({ ...p, quantity: e.target.value }))
              }
              disabled={busy !== null}
            />
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="سعر الوحدة"
              className="input text-end"
              value={newLine.unitPrice}
              onChange={(e) =>
                setNewLine((p) => ({ ...p, unitPrice: e.target.value }))
              }
              disabled={busy !== null}
            />
            <button
              type="button"
              className="button-secondary text-sm"
              onClick={handleAddLine}
              disabled={busy !== null}
            >
              {busy === "addLine" ? "جاري الإضافة…" : "+ إضافة بند"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Pricing summary */}
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Notes */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <label className="text-sm font-semibold">ملاحظات</label>
            <textarea
              className="input mt-2 w-full"
              rows={3}
              defaultValue={quote.notes ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (quote.notes ?? "")) {
                  void patchQuote({ notes: e.target.value });
                }
              }}
              disabled={!isDraft || !canManageQuotes || busy !== null}
              placeholder="ملاحظات تظهر داخلياً بجانب عرض السعر."
            />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-amber-50 p-4">
            <label className="text-sm font-semibold">
              ملاحظات داخلية
              <span className="ms-2 text-xs font-normal text-[var(--muted-foreground)]">
                للاستخدام الداخلي فقط
              </span>
            </label>
            <textarea
              className="input mt-2 w-full bg-white"
              rows={3}
              defaultValue={quote.internalNotes ?? ""}
              onBlur={(e) => {
                if (e.target.value !== (quote.internalNotes ?? "")) {
                  void patchQuote({ internalNotes: e.target.value });
                }
              }}
              disabled={!isDraft || !canManageQuotes || busy !== null}
            />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
            <label className="text-sm font-semibold">صالح حتى</label>
            <input
              type="date"
              className="input mt-2"
              defaultValue={validUntilValue}
              onBlur={(e) => {
                if (e.target.value !== validUntilValue) {
                  void patchQuote({ validUntil: e.target.value || null });
                }
              }}
              disabled={!isDraft || !canManageQuotes || busy !== null}
            />
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-4">
          <h4 className="text-sm font-semibold">ملخّص التسعير</h4>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted-foreground)]">المجموع الفرعي</dt>
              <dd className="font-semibold tabular-nums">
                {formatSAR(quote.subtotal)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">الخصم</dt>
              <dd>
                {isDraft && canManageQuotes ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input w-28 text-end"
                    defaultValue={String(quote.discount ?? "0")}
                    onBlur={(e) => {
                      if (e.target.value !== String(quote.discount ?? "0")) {
                        void patchQuote({ discount: e.target.value });
                      }
                    }}
                    disabled={busy !== null}
                  />
                ) : (
                  <span className="font-semibold tabular-nums">
                    {formatSAR(quote.discount)}
                  </span>
                )}
              </dd>
            </div>
            {isDraft && canManageQuotes ? (
              <input
                type="text"
                className="input w-full"
                placeholder="سبب الخصم"
                defaultValue={quote.discountReason ?? ""}
                onBlur={(e) => {
                  if (e.target.value !== (quote.discountReason ?? "")) {
                    void patchQuote({ discountReason: e.target.value });
                  }
                }}
                disabled={busy !== null}
              />
            ) : quote.discountReason ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                {quote.discountReason}
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--muted-foreground)]">نسبة الضريبة %</dt>
              <dd>
                {isDraft && canManageQuotes ? (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input w-20 text-end"
                    defaultValue={String(quote.taxRate)}
                    onBlur={(e) => {
                      if (e.target.value !== String(quote.taxRate)) {
                        void patchQuote({ taxRate: e.target.value });
                      }
                    }}
                    disabled={busy !== null}
                  />
                ) : (
                  <span className="font-semibold tabular-nums">
                    {String(quote.taxRate)}%
                  </span>
                )}
              </dd>
            </div>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--muted-foreground)]">شامل ضريبة؟</span>
              <input
                type="checkbox"
                defaultChecked={quote.taxInclusive}
                onChange={(e) =>
                  void patchQuote({ taxInclusive: e.target.checked })
                }
                disabled={!isDraft || !canManageQuotes || busy !== null}
              />
            </label>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted-foreground)]">مبلغ الضريبة</dt>
              <dd className="font-semibold tabular-nums">
                {formatSAR(quote.taxAmount)}
              </dd>
            </div>
            <div
              className="mt-2 flex items-center justify-between border-t pt-3"
              style={{ borderColor: "var(--border)" }}
            >
              <dt className="text-base font-semibold">الإجمالي</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatSAR(quote.total)}
              </dd>
            </div>
          </dl>
          {busy === "save" ? (
            <p className="mt-3 text-xs text-[var(--muted-foreground)]">
              جاري الحفظ…
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default QuoteForm;
