import type { ProjectDetail, ProjectListItem } from "@/modules/projects/project.schemas";

// ============================================================================
// Types
// ============================================================================

export type OpsProjectWorkspace = ProjectDetail & Pick<ProjectListItem, "openTaskCount" | "queuedTodayCount" | "waitingApprovalCount">;

export type QueueLane = "planned" | "active" | "done";
export type WidgetId = "todaysQueue" | "projects" | "quickNotes" | "alerts" | "teamStatus" | "calendar" | "activityFeed";
export type LayoutPreset = "default" | "focus" | "overview";

export type WidgetLayout = {
  id: WidgetId;
  title: string;
  colSpan: number;
  rowSpan: number;
  collapsed: boolean;
  visible: boolean;
  accentColor: string;
};

// ============================================================================
// Constants
// ============================================================================

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#6b7280",
  MEDIUM: "#3b82f6",
  HIGH: "#f59e0b",
  URGENT: "#ef4444",
};

export const STATUS_COLORS: Record<string, string> = {
  BACKLOG: "#6b7280",
  PLANNED: "#8b5cf6",
  PLANNED_TODAY: "#8b5cf6",
  IN_PROGRESS: "#14b8a6",
  WAITING_APPROVAL: "#f59e0b",
  BLOCKED: "#ef4444",
  DONE: "#10b981",
  CANCELLED: "#6b7280",
};

export const defaultWidgetLayouts: WidgetLayout[] = [
  { id: "todaysQueue", title: "طابور اليوم", colSpan: 2, rowSpan: 2, collapsed: false, visible: true, accentColor: "#14b8a6" },
  { id: "projects", title: "نظرة عامة على المشاريع", colSpan: 1, rowSpan: 2, collapsed: false, visible: true, accentColor: "#3b82f6" },
  { id: "alerts", title: "التنبيهات والموافقات", colSpan: 1, rowSpan: 1, collapsed: false, visible: true, accentColor: "#f59e0b" },
  { id: "teamStatus", title: "حالة الفريق", colSpan: 1, rowSpan: 1, collapsed: false, visible: true, accentColor: "#8b5cf6" },
  { id: "quickNotes", title: "ملاحظات سريعة", colSpan: 1, rowSpan: 1, collapsed: false, visible: true, accentColor: "#10b981" },
  { id: "calendar", title: "عرض التقويم", colSpan: 2, rowSpan: 1, collapsed: false, visible: true, accentColor: "#6366f1" },
  { id: "activityFeed", title: "سجل النشاط", colSpan: 2, rowSpan: 1, collapsed: false, visible: true, accentColor: "#ec4899" },
];

export const layoutPresets: Record<LayoutPreset, WidgetLayout[]> = {
  default: defaultWidgetLayouts,
  focus: [
    { id: "todaysQueue", title: "طابور اليوم", colSpan: 3, rowSpan: 2, collapsed: false, visible: true, accentColor: "#14b8a6" },
    { id: "alerts", title: "التنبيهات والموافقات", colSpan: 1, rowSpan: 2, collapsed: false, visible: true, accentColor: "#f59e0b" },
    { id: "projects", title: "نظرة عامة على المشاريع", colSpan: 1, rowSpan: 1, collapsed: true, visible: true, accentColor: "#3b82f6" },
    { id: "teamStatus", title: "حالة الفريق", colSpan: 1, rowSpan: 1, collapsed: true, visible: true, accentColor: "#8b5cf6" },
    { id: "quickNotes", title: "ملاحظات سريعة", colSpan: 1, rowSpan: 1, collapsed: true, visible: true, accentColor: "#10b981" },
    { id: "calendar", title: "عرض التقويم", colSpan: 1, rowSpan: 1, collapsed: true, visible: false, accentColor: "#6366f1" },
    { id: "activityFeed", title: "سجل النشاط", colSpan: 1, rowSpan: 1, collapsed: true, visible: false, accentColor: "#ec4899" },
  ],
  overview: [
    { id: "projects", title: "نظرة عامة على المشاريع", colSpan: 2, rowSpan: 2, collapsed: false, visible: true, accentColor: "#3b82f6" },
    { id: "todaysQueue", title: "طابور اليوم", colSpan: 2, rowSpan: 2, collapsed: false, visible: true, accentColor: "#14b8a6" },
    { id: "teamStatus", title: "حالة الفريق", colSpan: 1, rowSpan: 1, collapsed: false, visible: true, accentColor: "#8b5cf6" },
    { id: "alerts", title: "التنبيهات والموافقات", colSpan: 1, rowSpan: 1, collapsed: false, visible: true, accentColor: "#f59e0b" },
    { id: "calendar", title: "عرض التقويم", colSpan: 2, rowSpan: 1, collapsed: false, visible: true, accentColor: "#6366f1" },
    { id: "activityFeed", title: "سجل النشاط", colSpan: 2, rowSpan: 1, collapsed: false, visible: true, accentColor: "#ec4899" },
    { id: "quickNotes", title: "ملاحظات سريعة", colSpan: 2, rowSpan: 1, collapsed: false, visible: true, accentColor: "#10b981" },
  ],
};

export const ALL_WIDGETS: { id: WidgetId; title: string; accent: string }[] = [
  { id: "todaysQueue", title: "طابور اليوم", accent: "#14b8a6" },
  { id: "projects", title: "نظرة عامة على المشاريع", accent: "#3b82f6" },
  { id: "quickNotes", title: "ملاحظات سريعة", accent: "#10b981" },
  { id: "alerts", title: "التنبيهات والموافقات", accent: "#f59e0b" },
  { id: "teamStatus", title: "حالة الفريق", accent: "#8b5cf6" },
  { id: "calendar", title: "عرض التقويم", accent: "#6366f1" },
  { id: "activityFeed", title: "سجل النشاط", accent: "#ec4899" },
];

// ============================================================================
// Utility
// ============================================================================

export function cls(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  return `منذ ${Math.floor(hrs / 24)} ي`;
}

export async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) { const p = await r.json().catch(() => null) as { error?: { message?: string } } | null; throw new Error(p?.error?.message || "فشل الطلب."); }
  return r.json().catch(() => null);
}
