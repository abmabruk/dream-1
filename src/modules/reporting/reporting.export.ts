import {
  INQUIRY_STAGE_LABELS,
  type InquiryStage,
} from "@/modules/crm/inquiry-stage";
import {
  ORDER_STATUS_LABELS,
  type OrderWorkflowStatus,
} from "@/modules/orders/order-status";

import type { ReportingSnapshot } from "./reporting.repository";

function escapeCsvValue(value: string | number | null | undefined) {
  const stringValue = value == null ? "" : String(value);

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function buildCsv(headers: string[], rows: Array<Record<string, string | number | null>>) {
  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(",")
    ),
  ];

  return lines.join("\n");
}

function orderStatusLabel(status: OrderWorkflowStatus) {
  return ORDER_STATUS_LABELS[status];
}

function inquiryStageLabel(stage: InquiryStage) {
  return INQUIRY_STAGE_LABELS[stage];
}

export function buildReportingCsv(snapshot: ReportingSnapshot) {
  const headers = [
    "section",
    "label",
    "value",
    "date",
    "month",
    "status",
    "stage",
    "customer_name",
    "worker_name",
    "phone",
    "assigned_to",
    "orders_created",
    "orders_delivered",
    "customers_added",
    "inquiries_created",
    "quoted_revenue",
    "delivered_revenue",
    "completed_assignments",
    "in_progress_assignments",
    "planned_assignments",
    "days_late",
  ];
  const rows: Array<Record<string, string | number | null>> = [];

  rows.push(
    { section: "filters", label: "from", value: snapshot.range.from },
    { section: "filters", label: "to", value: snapshot.range.to },
    {
      section: "filters",
      label: "order statuses",
      value:
        snapshot.filters.orderStatuses.length === 0
          ? "All"
          : snapshot.filters.orderStatuses.map(orderStatusLabel).join(" | "),
    },
    {
      section: "filters",
      label: "inquiry stages",
      value:
        snapshot.filters.inquiryStages.length === 0
          ? "All"
          : snapshot.filters.inquiryStages.map(inquiryStageLabel).join(" | "),
    }
  );

  rows.push(
    { section: "summary", label: "orders created", value: snapshot.summary.ordersCreated },
    { section: "summary", label: "orders approved", value: snapshot.summary.ordersApproved },
    { section: "summary", label: "orders delivered", value: snapshot.summary.ordersDelivered },
    { section: "summary", label: "new customers", value: snapshot.summary.newCustomers },
    { section: "summary", label: "new inquiries", value: snapshot.summary.newInquiries },
    { section: "summary", label: "quoted revenue", value: snapshot.summary.quotedRevenue },
    {
      section: "summary",
      label: "delivered revenue",
      value: snapshot.summary.deliveredRevenue,
    },
    {
      section: "summary",
      label: "completed assignments",
      value: snapshot.summary.completedAssignments,
    },
    { section: "summary", label: "overdue orders", value: snapshot.summary.overdueOrders },
    { section: "summary", label: "due follow-ups", value: snapshot.summary.dueFollowUps }
  );

  for (const entry of snapshot.currentPipeline.orderStatuses) {
    rows.push({
      section: "order_pipeline",
      status: orderStatusLabel(entry.status),
      value: entry.count,
    });
  }

  for (const entry of snapshot.currentPipeline.inquiryStages) {
    rows.push({
      section: "crm_pipeline",
      stage: inquiryStageLabel(entry.stage),
      value: entry.count,
    });
  }

  for (const entry of snapshot.activitySeries) {
    rows.push({
      section: "daily_activity",
      date: entry.date,
      orders_created: entry.ordersCreated,
      orders_delivered: entry.ordersDelivered,
      customers_added: entry.customersAdded,
      inquiries_created: entry.inquiriesCreated,
    });
  }

  for (const entry of snapshot.monthlySeries) {
    rows.push({
      section: "monthly_trends",
      month: entry.month,
      orders_created: entry.ordersCreated,
      orders_delivered: entry.ordersDelivered,
      customers_added: entry.customersAdded,
      inquiries_created: entry.inquiriesCreated,
      quoted_revenue: entry.quotedRevenue,
      delivered_revenue: entry.deliveredRevenue,
    });
  }

  for (const customer of snapshot.topCustomers) {
    rows.push({
      section: "top_customers",
      customer_name: customer.customerName,
      value: customer.orderCount,
      quoted_revenue: customer.quotedRevenue,
      delivered_revenue: customer.deliveredRevenue,
    });
  }

  for (const worker of snapshot.workerOutput) {
    rows.push({
      section: "worker_output",
      worker_name: worker.workerName,
      completed_assignments: worker.completedAssignments,
      in_progress_assignments: worker.inProgressAssignments,
      planned_assignments: worker.plannedAssignments,
    });
  }

  for (const order of snapshot.overdueOrderList) {
    rows.push({
      section: "overdue_orders",
      label: order.code,
      value: order.title,
      customer_name: order.customerName,
      status: orderStatusLabel(order.status),
      date: order.targetDate,
      days_late: order.daysLate,
    });
  }

  for (const inquiry of snapshot.followUpList) {
    rows.push({
      section: "follow_up_queue",
      value: inquiry.name,
      stage: inquiryStageLabel(inquiry.stage),
      date: inquiry.nextFollowUpAt,
      phone: inquiry.phone,
      assigned_to: inquiry.assignedToName,
    });
  }

  return buildCsv(headers, rows);
}
