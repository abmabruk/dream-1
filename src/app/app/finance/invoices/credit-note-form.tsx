"use client";

/**
 * CreditNoteForm — modal sub-component used from the invoice detail
 * screen. Lets the user pick which invoice lines to credit, enter a
 * reason, and either save as a draft credit note or save+issue in one
 * step.
 */

import { useCallback, useMemo, useState } from "react";

import { BottomSheet, useToast } from "@/components/ui";
import { formatSAR } from "@/lib/format";
import type { InvoiceLineDetail } from "@/modules/invoices/invoice.schemas";

interface CreditNoteFormProps {
  open: boolean;
  invoiceId: string;
  invoiceLines: InvoiceLineDetail[];
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}

type DraftLine = {
  description: string;
  quantity: string;
  unitPrice: string;
  invoiceLineId: string | null;
};

const EMPTY_LINE: DraftLine = {
  description: "",
  quantity: "1",
  unitPrice: "0",
  invoiceLineId: null,
};

export function CreditNoteForm({
  open,
  invoiceId,
  invoiceLines,
  onClose,
  onCreated,
}: CreditNoteFormProps) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ ...EMPTY_LINE }]);
  const [busy, setBusy] = useState<"draft" | "issue" | null>(null);

  const total = useMemo(
    () =>
      lines.reduce(
        (acc, l) => acc + Number(l.quantity || 0) * Number(l.unitPrice || 0),
        0,
      ),
    [lines],
  );

  const addLine = useCallback(() => {
    setLines((p) => [...p, { ...EMPTY_LINE }]);
  }, []);

  const removeLine = useCallback((idx: number) => {
    setLines((p) => p.filter((_, i) => i !== idx));
  }, []);

  const updateLine = useCallback((idx: number, patch: Partial<DraftLine>) => {
    setLines((p) => p.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }, []);

  const importFromInvoice = useCallback(
    (lineId: string) => {
      const src = invoiceLines.find((l) => l.id === lineId);
      if (!src) return;
      setLines((p) => [
        ...p,
        {
          description: src.description,
          quantity: String(src.quantity),
          unitPrice: String(src.unitPrice),
          invoiceLineId: src.id,
        },
      ]);
    },
    [invoiceLines],
  );

  const submit = useCallback(
    async (mode: "draft" | "issue") => {
      if (!reason.trim()) {
        toast("السبب مطلوب", "error");
        return;
      }
      const validLines = lines.filter((l) => l.description.trim());
      if (validLines.length === 0) {
        toast("أضف بنداً واحداً على الأقل", "error");
        return;
      }
      setBusy(mode);
      try {
        const r = await fetch(
          `/api/v1/invoices/${invoiceId}/credit-notes`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: reason.trim(),
              lines: validLines.map((l) => ({
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                ...(l.invoiceLineId
                  ? { invoiceLineId: l.invoiceLineId }
                  : {}),
              })),
            }),
          },
        );
        const json = await r.json();
        if (!r.ok || !json.ok) {
          toast(json?.error?.message ?? "تعذّر إنشاء الإشعار الدائن", "error");
          return;
        }
        const created = json.data as { id: string };
        if (mode === "issue") {
          const r2 = await fetch(
            `/api/v1/credit-notes/${created.id}/issue`,
            { method: "POST" },
          );
          const j2 = await r2.json();
          if (!r2.ok || !j2.ok) {
            toast(j2?.error?.message ?? "تعذّر إصدار الإشعار", "error");
            return;
          }
          toast("تم إصدار الإشعار الدائن", "success");
        } else {
          toast("تم حفظ المسودة", "success");
        }
        setReason("");
        setLines([{ ...EMPTY_LINE }]);
        await onCreated();
        onClose();
      } catch (e) {
        toast(e instanceof Error ? e.message : "خطأ في الاتصال", "error");
      } finally {
        setBusy(null);
      }
    },
    [reason, lines, invoiceId, toast, onClose, onCreated],
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="إنشاء إشعار دائن"
    >
      <div className="space-y-4">
        <div>
          <label className="text-sm font-semibold">السبب</label>
          <textarea
            className="input mt-2 w-full"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: إرجاع جزئي للبضاعة، تصحيح خطأ في الفاتورة…"
          />
        </div>

        {invoiceLines.length > 0 ? (
          <div>
            <label className="text-sm font-semibold">
              استيراد بند من الفاتورة الأصلية
            </label>
            <select
              className="input mt-2 w-full"
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  importFromInvoice(e.target.value);
                  e.target.value = "";
                }
              }}
            >
              <option value="">اختر بنداً للاستيراد…</option>
              {invoiceLines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.description} ({formatSAR(l.lineTotal)})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <h4 className="text-sm font-semibold">البنود</h4>
          <div className="mt-2 space-y-2">
            {lines.map((line, idx) => (
              <div
                key={idx}
                className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 sm:grid-cols-[1fr_5rem_7rem_auto]"
              >
                <input
                  type="text"
                  className="input"
                  placeholder="الوصف"
                  value={line.description}
                  onChange={(e) =>
                    updateLine(idx, { description: e.target.value })
                  }
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input text-end"
                  placeholder="الكمية"
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(idx, { quantity: e.target.value })
                  }
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input text-end"
                  placeholder="سعر الوحدة"
                  value={line.unitPrice}
                  onChange={(e) =>
                    updateLine(idx, { unitPrice: e.target.value })
                  }
                />
                <button
                  type="button"
                  className="button-danger text-xs"
                  style={{ height: "2rem", paddingInline: "0.75rem" }}
                  onClick={() => removeLine(idx)}
                  disabled={lines.length === 1}
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="button-secondary mt-2 text-sm"
            onClick={addLine}
          >
            + إضافة بند
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-3">
          <span className="text-sm text-[var(--muted-foreground)]">
            الإجمالي قبل الضريبة
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {formatSAR(total)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            className="button-secondary text-sm"
            onClick={onClose}
            disabled={busy !== null}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="button-secondary text-sm"
            onClick={() => submit("draft")}
            disabled={busy !== null}
          >
            {busy === "draft" ? "جاري الحفظ…" : "حفظ كمسودة"}
          </button>
          <button
            type="button"
            className="button-primary text-sm"
            onClick={() => submit("issue")}
            disabled={busy !== null}
          >
            {busy === "issue" ? "جاري الإصدار…" : "إصدار"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

export default CreditNoteForm;
