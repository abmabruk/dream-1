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
  const H = {
    section: "القسم",
    label: "التسمية",
    value: "القيمة",
    date: "التاريخ",
    month: "الشهر",
    status: "الحالة",
    stage: "المرحلة",
    customer_name: "اسم العميل",
    worker_name: "اسم العامل",
    phone: "الهاتف",
    assigned_to: "المسؤول",
    orders_created: "الطلبات المنشأة",
    orders_delivered: "الطلبات المسلمة",
    customers_added: "العملاء المضافون",
    inquiries_created: "الاستفسارات المنشأة",
    quoted_revenue: "الإيرادات المسعرة",
    delivered_revenue: "الإيرادات المسلمة",
    completed_assignments: "المهام المكتملة",
    in_progress_assignments: "المهام قيد التنفيذ",
    planned_assignments: "المهام المخططة",
    days_late: "أيام التأخير",
  };

  const headers = Object.values(H);
  const rows: Array<Record<string, string | number | null>> = [];

  rows.push(
    { [H.section]: "الفلاتر", [H.label]: "من", [H.value]: snapshot.range.from },
    { [H.section]: "الفلاتر", [H.label]: "إلى", [H.value]: snapshot.range.to },
    {
      [H.section]: "الفلاتر",
      [H.label]: "حالات الطلبات",
      [H.value]:
        snapshot.filters.orderStatuses.length === 0
          ? "الكل"
          : snapshot.filters.orderStatuses.map(orderStatusLabel).join(" | "),
    },
    {
      [H.section]: "الفلاتر",
      [H.label]: "مراحل الاستفسارات",
      [H.value]:
        snapshot.filters.inquiryStages.length === 0
          ? "الكل"
          : snapshot.filters.inquiryStages.map(inquiryStageLabel).join(" | "),
    }
  );

  rows.push(
    { [H.section]: "الملخص", [H.label]: "الطلبات المنشأة", [H.value]: snapshot.summary.ordersCreated },
    { [H.section]: "الملخص", [H.label]: "الطلبات المعتمدة", [H.value]: snapshot.summary.ordersApproved },
    { [H.section]: "الملخص", [H.label]: "الطلبات المسلمة", [H.value]: snapshot.summary.ordersDelivered },
    { [H.section]: "الملخص", [H.label]: "العملاء الجدد", [H.value]: snapshot.summary.newCustomers },
    { [H.section]: "الملخص", [H.label]: "الاستفسارات الجديدة", [H.value]: snapshot.summary.newInquiries },
    { [H.section]: "الملخص", [H.label]: "الإيرادات المسعرة", [H.value]: snapshot.summary.quotedRevenue },
    {
      [H.section]: "الملخص",
      [H.label]: "الإيرادات المسلمة",
      [H.value]: snapshot.summary.deliveredRevenue,
    },
    {
      [H.section]: "الملخص",
      [H.label]: "المهام المكتملة",
      [H.value]: snapshot.summary.completedAssignments,
    },
    { [H.section]: "الملخص", [H.label]: "الطلبات المتأخرة", [H.value]: snapshot.summary.overdueOrders },
    { [H.section]: "الملخص", [H.label]: "المتابعات المستحقة", [H.value]: snapshot.summary.dueFollowUps }
  );

  for (const entry of snapshot.currentPipeline.orderStatuses) {
    rows.push({
      [H.section]: "خط_أنابيب_الطلبات",
      [H.status]: orderStatusLabel(entry.status),
      [H.value]: entry.count,
    });
  }

  for (const entry of snapshot.currentPipeline.inquiryStages) {
    rows.push({
      [H.section]: "خط_أنابيب_الاستفسارات",
      [H.stage]: inquiryStageLabel(entry.stage),
      [H.value]: entry.count,
    });
  }

  for (const entry of snapshot.activitySeries) {
    rows.push({
      [H.section]: "النشاط_اليومي",
      [H.date]: entry.date,
      [H.orders_created]: entry.ordersCreated,
      [H.orders_delivered]: entry.ordersDelivered,
      [H.customers_added]: entry.customersAdded,
      [H.inquiries_created]: entry.inquiriesCreated,
    });
  }

  for (const entry of snapshot.monthlySeries) {
    rows.push({
      [H.section]: "الاتجاهات_الشهرية",
      [H.month]: entry.month,
      [H.orders_created]: entry.ordersCreated,
      [H.orders_delivered]: entry.ordersDelivered,
      [H.customers_added]: entry.customersAdded,
      [H.inquiries_created]: entry.inquiriesCreated,
      [H.quoted_revenue]: entry.quotedRevenue,
      [H.delivered_revenue]: entry.deliveredRevenue,
    });
  }

  for (const customer of snapshot.topCustomers) {
    rows.push({
      [H.section]: "أفضل_العملاء",
      [H.customer_name]: customer.customerName,
      [H.value]: customer.orderCount,
      [H.quoted_revenue]: customer.quotedRevenue,
      [H.delivered_revenue]: customer.deliveredRevenue,
    });
  }

  for (const worker of snapshot.workerOutput) {
    rows.push({
      [H.section]: "إنتاجية_العمال",
      [H.worker_name]: worker.workerName,
      [H.completed_assignments]: worker.completedAssignments,
      [H.in_progress_assignments]: worker.inProgressAssignments,
      [H.planned_assignments]: worker.plannedAssignments,
    });
  }

  for (const order of snapshot.overdueOrderList) {
    rows.push({
      [H.section]: "الطلبات_المتأخرة",
      [H.label]: order.code,
      [H.value]: order.title,
      [H.customer_name]: order.customerName,
      [H.status]: orderStatusLabel(order.status),
      [H.date]: order.targetDate,
      [H.days_late]: order.daysLate,
    });
  }

  for (const inquiry of snapshot.followUpList) {
    rows.push({
      [H.section]: "قائمة_المتابعات",
      [H.value]: inquiry.name,
      [H.stage]: inquiryStageLabel(inquiry.stage),
      [H.date]: inquiry.nextFollowUpAt,
      [H.phone]: inquiry.phone,
      [H.assigned_to]: inquiry.assignedToName,
    });
  }

  return buildCsv(headers, rows);
}
