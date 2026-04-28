import { z } from "zod";

import {
  INQUIRY_STAGE_VALUES,
  type InquiryStage,
} from "@/modules/crm/inquiry-stage";
import {
  ORDER_STATUS_VALUES,
  type OrderWorkflowStatus,
} from "@/modules/orders/order-status";

const REPORT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

const orderStatusSchema = z.enum(ORDER_STATUS_VALUES);
const inquiryStageSchema = z.enum(INQUIRY_STAGE_VALUES);

function pickFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function pickMany(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function toUtcStart(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

function toUtcEnd(date: string) {
  return new Date(`${date}T23:59:59.999Z`);
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

const reportingQuerySchema = z
  .object({
    from: z.string().regex(REPORT_DATE_REGEX).optional(),
    to: z.string().regex(REPORT_DATE_REGEX).optional(),
    orderStatus: z.array(orderStatusSchema).default([]),
    inquiryStage: z.array(inquiryStageSchema).default([]),
  })
  .transform((value, ctx) => {
    const today = new Date();
    const todayStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
    );
    const defaultFrom = new Date(todayStart);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);

    const from = value.from ?? toDateKey(defaultFrom);
    const to = value.to ?? toDateKey(todayStart);
    const startAt = toUtcStart(from);
    const endAt = toUtcEnd(to);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "نطاق تاريخ التقرير غير صالح",
      });
      return z.NEVER;
    }

    const days =
      Math.floor((endAt.getTime() - startAt.getTime()) / ONE_DAY_IN_MS) + 1;

    if (days < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "يجب أن يكون تاريخ البداية قبل أو يساوي تاريخ النهاية",
      });
      return z.NEVER;
    }

    if (days > 366) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "لا يمكن أن يتجاوز نطاق التقرير 366 يوماً",
      });
      return z.NEVER;
    }

    return {
      from,
      to,
      startAt,
      endAt,
      days,
      filters: {
        orderStatuses: Array.from(new Set(value.orderStatus)),
        inquiryStages: Array.from(new Set(value.inquiryStage)),
      },
    };
  });

export type ReportingQuery = z.output<typeof reportingQuerySchema>;

export function parseReportingQuery(input: {
  from?: string | string[];
  to?: string | string[];
  orderStatus?: string | string[];
  inquiryStage?: string | string[];
}) {
  return reportingQuerySchema.parse({
    from: pickFirst(input.from),
    to: pickFirst(input.to),
    orderStatus: pickMany(input.orderStatus),
    inquiryStage: pickMany(input.inquiryStage),
  });
}

export function createReportSearchParams(input: {
  from: string;
  to: string;
  orderStatuses?: OrderWorkflowStatus[];
  inquiryStages?: InquiryStage[];
}) {
  const params = new URLSearchParams();
  params.set("from", input.from);
  params.set("to", input.to);

  for (const status of Array.from(new Set(input.orderStatuses ?? []))) {
    params.append("orderStatus", status);
  }

  for (const stage of Array.from(new Set(input.inquiryStages ?? []))) {
    params.append("inquiryStage", stage);
  }

  return params.toString();
}
