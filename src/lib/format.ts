/**
 * Dream 1 — formatting utilities (ar-SA).
 *
 * Centralizes currency, number, date and relative-time formatting so that
 * dashboards, project hub, finance and floor screen all speak one
 * consistent visual language.
 */

const NUMBER_AR = new Intl.NumberFormat("ar-SA");

/**
 * Format a SAR amount with Arabic numerals. By default the function strips
 * the trailing `.00` when the amount is whole (matches the "decimals: 0
 * when whole, 2 when fractional" rule in the spec).
 */
export function formatSAR(
  value: number | string | null | undefined,
  opts: { decimals?: 0 | 2; currency?: string } = {},
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";

  const currency = opts.currency ?? "SAR";
  const isWhole = Number.isInteger(n);
  const decimals = opts.decimals ?? (isWhole ? 0 : 2);

  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** Format an integer / float using Arabic numerals (no currency). */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (!Number.isFinite(value)) return "—";
  return NUMBER_AR.format(value);
}

/** Format a date in Arabic short style. */
export function formatDateAr(
  value: Date | string | null | undefined,
): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/**
 * Arabic relative time — "الآن", "قبل ٣ ساعات", etc. Works with strings
 * and Dates. Used by ActivityTimeline and the dashboard recent feeds.
 */
export function formatRelativeTime(
  value: Date | string | null | undefined,
): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const ts = date.getTime();
  if (Number.isNaN(ts)) return "";

  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 45) return "الآن";
  if (diffSec < 90) return "قبل دقيقة";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 45) return `قبل ${formatNumber(diffMin)} دقيقة`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `قبل ${formatNumber(diffH)} ${diffH === 1 ? "ساعة" : "ساعات"}`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `قبل ${formatNumber(diffD)} ${diffD === 1 ? "يوم" : "أيام"}`;
  const diffW = Math.floor(diffD / 7);
  if (diffW < 5) return `قبل ${formatNumber(diffW)} ${diffW === 1 ? "أسبوع" : "أسابيع"}`;
  const diffMo = Math.floor(diffD / 30);
  if (diffMo < 12) return `قبل ${formatNumber(diffMo)} ${diffMo === 1 ? "شهر" : "أشهر"}`;
  const diffY = Math.floor(diffD / 365);
  return `قبل ${formatNumber(diffY)} ${diffY === 1 ? "سنة" : "سنوات"}`;
}

/**
 * Time-of-day Arabic greeting — used in the dashboard hero.
 */
export function arabicGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "مساء الخير";
  if (h < 12) return "صباح الخير";
  if (h < 18) return "مساء الخير";
  return "مساء الخير";
}
