"use client";

/**
 * QuoteCard — compact card for a single quote version in the QuotesPanel
 * list. Shows version, status pill, total, and createdAt. Click selects
 * the quote for inline detail/edit view.
 */

import { StatusPill } from "@/components/ui";
import { formatDateAr, formatSAR } from "@/lib/format";
import type { Tone } from "@/lib/status-tone";

export const QUOTE_STATUS_LABELS_AR: Record<string, string> = {
  DRAFT: "مسودة",
  SENT: "مُرسَل",
  APPROVED: "معتمد",
  SUPERSEDED: "مستبدل",
  REJECTED: "مرفوض",
  CANCELLED: "ملغي",
  EXPIRED: "منتهي الصلاحية",
};

export const QUOTE_STATUS_TONE: Record<string, Tone> = {
  DRAFT: "draft",
  SENT: "in-progress",
  APPROVED: "done",
  SUPERSEDED: "cancelled",
  REJECTED: "blocked",
  CANCELLED: "cancelled",
  EXPIRED: "waiting",
};

export interface QuoteCardData {
  id: string;
  version: number;
  status: string;
  total: string | number | null;
  createdAt: string;
}

interface QuoteCardProps {
  quote: QuoteCardData;
  selected?: boolean;
  onSelect: (id: string) => void;
}

export function QuoteCard({ quote, selected = false, onSelect }: QuoteCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(quote.id)}
      className={`block w-full rounded-xl border px-4 py-3 text-start transition-colors hover:bg-[var(--panel-strong)] ${
        selected
          ? "border-[var(--accent)] bg-[var(--panel-strong)]"
          : "border-[var(--border)] bg-[var(--panel)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">
            الإصدار {quote.version}
          </span>
          <StatusPill
            status={quote.status}
            label={QUOTE_STATUS_LABELS_AR[quote.status] ?? quote.status}
            tone={QUOTE_STATUS_TONE[quote.status]}
            size="sm"
          />
        </div>
        <span className="text-sm font-semibold tabular-nums">
          {formatSAR(quote.total)}
        </span>
      </div>
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        أُنشئ في {formatDateAr(quote.createdAt)}
      </p>
    </button>
  );
}

export default QuoteCard;
