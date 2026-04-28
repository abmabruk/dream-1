"use client";

/**
 * Wave 2 — Stage drawer.
 *
 * Opened from <StagesTimeline /> when a circle is clicked. Renders inside
 * a <BottomSheet>: bottom sheet on mobile, modal on desktop.
 *
 * Responsibilities:
 *   - Show stage metadata (name, description, status, owner, dates, cycle).
 *   - Drive transitions: start NOT_STARTED stages, advance IN_PROGRESS
 *     stages to next, skip optional stages, attest deposit.
 *   - When advancing an IN_PROGRESS stage whose next stage requires a
 *     deposit (or whose own flag does and it isn't attested), the primary
 *     CTA flips to "تأكيد العربون أولاً" and opens the inline attestation
 *     form.
 *   - Every action emits a toast + router.refresh + closes the drawer.
 *
 * The drawer is read-only for users without `canManage`; they see status
 * but no action buttons.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import {
  BottomSheet,
  StatusPill,
  useToast,
} from "@/components/ui";
import { computeCycleTime } from "@/lib/cycle-time";
import { formatDateAr, formatNumber, formatRelativeTime } from "@/lib/format";
import type { StageInstanceItem } from "@/modules/projects/project.schemas";

interface StageDrawerProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  stageInstance: StageInstanceItem | null;
  stageInstances: StageInstanceItem[];
  canManage: boolean;
}

const STAGE_STATUS_LABELS_AR: Record<string, string> = {
  NOT_STARTED: "لم تبدأ",
  IN_PROGRESS: "قيد التنفيذ",
  BLOCKED: "متوقفة",
  COMPLETED: "مكتملة",
  SKIPPED: "تم تخطّيها",
};

const DEPOSIT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: "تحويل بنكي",
  cash: "نقداً",
  check: "شيك",
  stc_pay: "STC Pay",
  other: "أخرى",
};

async function postJson(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const payload = (await r.json().catch(() => null)) as
    | {
        ok: boolean;
        error?: { message?: string; details?: { code?: string } };
        data?: unknown;
      }
    | null;
  if (!r.ok || !payload?.ok) {
    const message = payload?.error?.message || "فشل الطلب.";
    const code = payload?.error?.details?.code;
    const err = new Error(message) as Error & { code?: string };
    if (code) err.code = code;
    throw err;
  }
  return payload?.data;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function cycleLine(stage: StageInstanceItem): {
  text: string;
  tone: "ok" | "over" | "neutral";
} | null {
  if (!stage.startedAt) return null;
  const ct = computeCycleTime(stage);
  if (ct.expected !== null) {
    return {
      text: `${formatNumber(ct.days)} يوم / المتوقع ${formatNumber(ct.expected)} يوم`,
      tone: ct.status === "over" ? "over" : "ok",
    };
  }
  return { text: `${formatNumber(ct.days)} يوم`, tone: "neutral" };
}

export function StageDrawer({
  open,
  onClose,
  projectId,
  stageInstance,
  stageInstances,
  canManage,
}: StageDrawerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [showDepositForm, setShowDepositForm] = useState(false);

  // Deposit form state (controlled).
  const [depositAmount, setDepositAmount] = useState("");
  const [depositReceivedAt, setDepositReceivedAt] = useState(todayIsoDate());
  const [depositMethod, setDepositMethod] =
    useState<"bank_transfer" | "cash" | "check" | "stc_pay" | "other">(
      "bank_transfer"
    );
  const [depositNote, setDepositNote] = useState("");
  const [depositReceiptUrl, setDepositReceiptUrl] = useState("");
  const [drawingsApproved, setDrawingsApproved] = useState(false);

  const sortedInstances = useMemo(
    () => [...stageInstances].sort((a, b) => a.sortOrder - b.sortOrder),
    [stageInstances]
  );

  const nextStage = useMemo(() => {
    if (!stageInstance) return null;
    return (
      sortedInstances.find((s) => s.sortOrder > stageInstance.sortOrder) ?? null
    );
  }, [sortedInstances, stageInstance]);

  const needsDepositBeforeAdvance = useMemo(() => {
    if (!stageInstance) return false;
    if (stageInstance.depositAttested) return false;
    if (stageInstance.requiresDepositAttestation) return true;
    if (nextStage?.requiresDepositAttestation) return true;
    return false;
  }, [stageInstance, nextStage]);

  const handleClose = () => {
    if (busy) return;
    setShowDepositForm(false);
    onClose();
  };

  const refreshAndClose = () => {
    router.refresh();
    setShowDepositForm(false);
    onClose();
  };

  const handleStart = async () => {
    if (!stageInstance) return;
    setBusy(true);
    try {
      await postJson(
        `/api/v1/projects/${projectId}/stages/${stageInstance.id}/start`,
        {}
      );
      toast("تم بدء المرحلة", "success");
      refreshAndClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذّر بدء المرحلة", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleAdvance = async () => {
    if (!stageInstance) return;
    if (needsDepositBeforeAdvance) {
      setShowDepositForm(true);
      return;
    }
    setBusy(true);
    try {
      await postJson(`/api/v1/projects/${projectId}/stages/advance`, {
        stageInstanceId: stageInstance.id,
      });
      toast("تم الانتقال للمرحلة التالية", "success");
      refreshAndClose();
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "DEPOSIT_REQUIRED") {
        toast("لا يمكن التقدّم قبل تأكيد العربون", "info");
        setShowDepositForm(true);
      } else {
        toast(err.message || "تعذّر الانتقال", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    if (!stageInstance) return;
    // Skipping is implemented as advance with a note; the repository moves
    // status forward. For Wave 2 we re-use advance and rely on the backend
    // to record the SKIPPED activity. (Wave 3: dedicated skip endpoint.)
    setBusy(true);
    try {
      await postJson(`/api/v1/projects/${projectId}/stages/advance`, {
        stageInstanceId: stageInstance.id,
        note: "تم التخطي",
      });
      toast("تم تخطّي المرحلة", "info");
      refreshAndClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذّر التخطي", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleAttestSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stageInstance) return;
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast("أدخل مبلغ عربون صحيح", "error");
      return;
    }
    setBusy(true);
    try {
      await postJson(
        `/api/v1/projects/${projectId}/stages/${stageInstance.id}/attest-deposit`,
        {
          amount,
          receivedAt: depositReceivedAt,
          method: depositMethod,
          note: depositNote || undefined,
          receiptUrl: depositReceiptUrl || undefined,
          drawingsApproved,
        }
      );
      toast("تم تأكيد استلام العربون", "success");
      router.refresh();
      setShowDepositForm(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذّر تأكيد العربون", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!stageInstance) {
    return (
      <BottomSheet open={open} onClose={handleClose} title="مرحلة">
        <p className="text-sm text-[var(--muted-foreground)]">
          لم يتم اختيار مرحلة.
        </p>
      </BottomSheet>
    );
  }

  const cycle = cycleLine(stageInstance);

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={
        <span className="inline-flex items-center gap-3">
          {stageInstance.name}
          <StatusPill
            status={stageInstance.status}
            label={STAGE_STATUS_LABELS_AR[stageInstance.status]}
          />
        </span>
      }
    >
      <div className="space-y-5">
        {/* Description */}
        {stageInstance.description ? (
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            {stageInstance.description}
          </p>
        ) : null}

        {/* Meta grid */}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              المسؤول
            </dt>
            <dd className="mt-1 font-medium">
              {stageInstance.ownerName || "غير مسند"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              المتوقع
            </dt>
            <dd className="mt-1 font-medium">
              {stageInstance.expectedDays
                ? `${formatNumber(stageInstance.expectedDays)} يوم`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              تاريخ البدء
            </dt>
            <dd className="mt-1 font-medium">
              {stageInstance.startedAt ? (
                <>
                  {formatDateAr(stageInstance.startedAt)}
                  <span className="ms-2 text-xs text-[var(--muted-foreground)]">
                    {formatRelativeTime(stageInstance.startedAt)}
                  </span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              تاريخ الإكمال
            </dt>
            <dd className="mt-1 font-medium">
              {stageInstance.completedAt ? (
                <>
                  {formatDateAr(stageInstance.completedAt)}
                  <span className="ms-2 text-xs text-[var(--muted-foreground)]">
                    {formatRelativeTime(stageInstance.completedAt)}
                  </span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          {cycle ? (
            <div className="col-span-2">
              <dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                زمن الدورة
              </dt>
              <dd
                className="mt-1 font-semibold"
                style={{
                  color:
                    cycle.tone === "over"
                      ? "#f59e0b"
                      : cycle.tone === "ok"
                        ? "#10b981"
                        : "var(--foreground)",
                }}
              >
                {cycle.text}
              </dd>
            </div>
          ) : null}
        </dl>

        {/* Deposit panel (if relevant) */}
        {stageInstance.requiresDepositAttestation ||
        nextStage?.requiresDepositAttestation ? (
          <div
            className="rounded-xl border p-3 text-sm"
            style={{
              borderColor: stageInstance.depositAttested
                ? "#10b98155"
                : "#f59e0b55",
              background: stageInstance.depositAttested
                ? "rgba(16,185,129,0.08)"
                : "rgba(245,158,11,0.08)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">حالة العربون</span>
              <span
                className="text-xs font-bold"
                style={{
                  color: stageInstance.depositAttested ? "#059669" : "#b45309",
                }}
              >
                {stageInstance.depositAttested
                  ? "تم التأكيد"
                  : "بانتظار التأكيد"}
              </span>
            </div>
            {stageInstance.depositAttested ? (
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--muted-foreground)]">
                {stageInstance.depositAmount !== null ? (
                  <div>
                    المبلغ:{" "}
                    <span className="font-semibold text-[var(--foreground)]">
                      {formatNumber(stageInstance.depositAmount)}
                    </span>
                  </div>
                ) : null}
                {stageInstance.depositReceivedAt ? (
                  <div>
                    التاريخ:{" "}
                    <span className="font-semibold text-[var(--foreground)]">
                      {formatDateAr(stageInstance.depositReceivedAt)}
                    </span>
                  </div>
                ) : null}
                {stageInstance.depositMethod ? (
                  <div>
                    الطريقة:{" "}
                    <span className="font-semibold text-[var(--foreground)]">
                      {DEPOSIT_METHOD_LABELS[stageInstance.depositMethod] ??
                        stageInstance.depositMethod}
                    </span>
                  </div>
                ) : null}
                {stageInstance.drawingsApproved ? (
                  <div className="font-semibold text-[#059669]">
                    ✓ رسومات الشغل معتمدة
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Notes display */}
        {stageInstance.notes ? (
          <div>
            <h3 className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              ملاحظات
            </h3>
            <p className="mt-1 whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--panel)] p-2 text-sm">
              {stageInstance.notes}
            </p>
          </div>
        ) : null}

        {/* Inline deposit attestation form */}
        {showDepositForm && canManage ? (
          <form
            onSubmit={handleAttestSubmit}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4"
          >
            <h3 className="text-sm font-semibold">تأكيد استلام العربون</h3>

            <label className="block">
              <span className="text-xs text-[var(--muted-foreground)]">
                المبلغ (ريال) *
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[var(--muted-foreground)]">
                تاريخ الاستلام *
              </span>
              <input
                type="date"
                value={depositReceivedAt}
                onChange={(e) => setDepositReceivedAt(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[var(--muted-foreground)]">
                طريقة الدفع
              </span>
              <select
                value={depositMethod}
                onChange={(e) =>
                  setDepositMethod(
                    e.target.value as typeof depositMethod
                  )
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm"
              >
                {Object.entries(DEPOSIT_METHOD_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-[var(--muted-foreground)]">
                رابط الإيصال (اختياري)
              </span>
              <input
                type="url"
                value={depositReceiptUrl}
                onChange={(e) => setDepositReceiptUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs text-[var(--muted-foreground)]">
                ملاحظة (اختياري)
              </span>
              <textarea
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm"
              />
            </label>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={drawingsApproved}
                onChange={(e) => setDrawingsApproved(e.target.checked)}
                className="mt-1"
              />
              <span>تم اعتماد رسومات الشغل من العميل</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setShowDepositForm(false)}
                disabled={busy}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={busy}
              >
                {busy ? "جاري الحفظ..." : "تأكيد"}
              </button>
            </div>
          </form>
        ) : null}

        {/* Action buttons */}
        {canManage && !showDepositForm ? (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {stageInstance.status === "NOT_STARTED" ? (
              <button
                type="button"
                className="button-primary"
                onClick={handleStart}
                disabled={busy}
              >
                بدء المرحلة
              </button>
            ) : null}

            {stageInstance.status === "IN_PROGRESS" &&
            stageInstance.requiresDepositAttestation &&
            !stageInstance.depositAttested ? (
              <button
                type="button"
                className="button-primary"
                style={{
                  background: "#f59e0b",
                  borderColor: "#f59e0b",
                  color: "#fff",
                }}
                onClick={() => setShowDepositForm(true)}
                disabled={busy}
              >
                تأكيد استلام العربون
              </button>
            ) : null}

            {stageInstance.status === "IN_PROGRESS" ? (
              <button
                type="button"
                className="button-primary"
                onClick={handleAdvance}
                disabled={busy}
              >
                {needsDepositBeforeAdvance
                  ? "تأكيد العربون أولاً"
                  : "إنهاء وانتقل للتالية"}
              </button>
            ) : null}

            {stageInstance.isOptional &&
            (stageInstance.status === "NOT_STARTED" ||
              stageInstance.status === "IN_PROGRESS") ? (
              <button
                type="button"
                className="button-secondary"
                onClick={handleSkip}
                disabled={busy}
              >
                تخطي المرحلة
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </BottomSheet>
  );
}
