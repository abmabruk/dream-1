import { z, ZodError } from "zod";

/**
 * Wraps a Zod string schema so that empty strings (and null) coming from
 * HTML form submissions are treated as `undefined`. This prevents
 * `min(1)` checks from rejecting legitimately empty optional inputs.
 *
 * Usage:
 *   nextFollowUpAt: emptyStringToUndefined(z.string().min(1).optional()),
 */
export function emptyStringToUndefined<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema,
  );
}

/**
 * Formats the first issue in a ZodError using an Arabic field-label map.
 * Falls back to the dotted path if the field is not in the map.
 */
export function formatZodErrorAr(
  error: ZodError,
  fieldLabels: Record<string, string>,
  fallback = "تعذّر التحقق من البيانات.",
): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const key = (issue.path[0] as string | undefined) ?? "";
  const label = fieldLabels[key] ?? issue.path.join(".") ?? "";
  const message = translateZodIssueMessageAr(issue);
  return label ? `${label}: ${message}` : message;
}

function translateZodIssueMessageAr(issue: {
  code?: string;
  message?: string;
  minimum?: unknown;
  maximum?: unknown;
  origin?: string;
}): string {
  switch (issue.code) {
    case "invalid_type":
      return "قيمة غير صالحة.";
    case "too_small":
      if (issue.origin === "string") {
        return issue.minimum === 1
          ? "هذا الحقل مطلوب."
          : `الحد الأدنى ${String(issue.minimum)} حرف.`;
      }
      return `القيمة أقل من الحد الأدنى (${String(issue.minimum)}).`;
    case "too_big":
      if (issue.origin === "string") {
        return `الحد الأقصى ${String(issue.maximum)} حرف.`;
      }
      return `القيمة أكبر من الحد الأقصى (${String(issue.maximum)}).`;
    case "invalid_format":
      return "تنسيق غير صالح.";
    case "invalid_value":
      return "قيمة غير مسموح بها.";
    default:
      return issue.message ?? "قيمة غير صالحة.";
  }
}
