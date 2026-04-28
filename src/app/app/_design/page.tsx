import { notFound } from "next/navigation";

import { requirePermission } from "@/modules/auth/guards";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  PriorityDot,
  ProjectCard,
  SkeletonCard,
  SkeletonRow,
  StatusPill,
  TaskCard,
} from "@/components/ui";
import { type Tone } from "@/lib/status-tone";

import { InteractiveDemo } from "./interactive-demo";

export const metadata = {
  title: "Design system — Dream 1",
};

const TONES: Tone[] = [
  "draft",
  "planned",
  "in-progress",
  "waiting",
  "blocked",
  "done",
  "cancelled",
];

const TONE_TO_DEMO_STATUS: Record<Tone, string> = {
  draft: "BACKLOG",
  planned: "PLANNED_TODAY",
  "in-progress": "IN_PROGRESS",
  waiting: "WAITING_APPROVAL",
  blocked: "BLOCKED",
  done: "DONE",
  cancelled: "CANCELLED",
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
        {description ? (
          <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();
  await requirePermission("ops:view");

  // Server-rendered design preview — Date.now() is intentional here so the
  // sample timestamps reflect real "today minus N days" data. The React purity
  // rule still flags it, but it's safe in a server component.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const days = (n: number) => new Date(now - n * 86_400_000);

  return (
    <main className="space-y-6">
      <PageHeader
        caption="نظام التصميم"
        title="مكتبة المكونات الموحدة"
        description="مرجع حي لجميع المكونات الأساسية التي ستستخدمها المراحل ٢ حتى ٧. كل عنصر هنا يستخدم نفس المتغيرات (tokens) ويدعم الوضعين الفاتح والداكن."
      />

      <Section title="Status Pills" description="نغمة واحدة لكل حالة عبر النظام بأكمله">
        <div className="flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <StatusPill key={tone} status={TONE_TO_DEMO_STATUS[tone]} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {TONES.map((tone) => (
            <StatusPill
              key={`sm-${tone}`}
              status={TONE_TO_DEMO_STATUS[tone]}
              size="sm"
            />
          ))}
        </div>
      </Section>

      <Section title="Priority Dots" description="نقطة صغيرة بجانب العنوان — العاجل ينبض">
        <div className="flex flex-wrap items-center gap-6">
          <PriorityDot priority="LOW" showLabel />
          <PriorityDot priority="MEDIUM" showLabel />
          <PriorityDot priority="HIGH" showLabel />
          <PriorityDot priority="URGENT" showLabel />
        </div>
      </Section>

      <Section title="Metric Cards" description="الأرقام الكبيرة في رؤوس الصفحات">
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="مكتمل اليوم" value={12} tone="accent" sublabel="+3 مقابل أمس" trend="up" />
          <MetricCard label="قيد التنفيذ" value={8} />
          <MetricCard label="بانتظار الموافقة" value={5} tone="warn" />
          <MetricCard label="متوقف" value={2} tone="danger" />
        </div>
      </Section>

      <Section title="Task Cards" description="بطاقات المهام بحالات مختلفة + مؤشر الخمول">
        <div className="grid gap-3 md:grid-cols-2">
          <TaskCard
            id="t-1"
            title="تجهيز خشب البلوط لمشروع المطبخ"
            status="IN_PROGRESS"
            priority="HIGH"
            projectCode="DRM-024"
            dueDate={days(-1)}
            assigneeName="محمد"
            lastActivityAt={days(0)}
            onDone={() => {}}
          />
          <TaskCard
            id="t-2"
            title="مراجعة المخطط النهائي مع العميل"
            status="WAITING_APPROVAL"
            priority="URGENT"
            projectCode="DRM-031"
            dueDate={days(-2)}
            assigneeName="سارة"
            lastActivityAt={days(4)}
            onApprove={() => {}}
            onReject={() => {}}
          />
          <TaskCard
            id="t-3"
            title="تركيب المفصلات وضبط الأبواب"
            status="PLANNED_TODAY"
            priority="MEDIUM"
            projectCode="DRM-018"
            assigneeName="خالد"
            lastActivityAt={days(8)}
            onStart={() => {}}
          />
          <TaskCard
            id="t-4"
            title="مهمة منجزة سابقاً"
            status="DONE"
            priority="LOW"
            projectCode="DRM-005"
            assigneeName="فهد"
            lastActivityAt={days(1)}
          />
        </div>
      </Section>

      <Section title="Project Cards" description="ملخص المشروع بشريط تقدم">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ProjectCard
            code="DRM-024"
            name="مطبخ فيلا حي العقيق"
            status="IN_PROGRESS"
            priority="HIGH"
            ownerName="عبدالله"
            dueDate={days(-14)}
            progress={62}
            openTaskCount={7}
          />
          <ProjectCard
            code="DRM-031"
            name="مكتبة جدارية لمكتب"
            status="WAITING_APPROVAL"
            priority="URGENT"
            ownerName="سارة"
            dueDate={days(-3)}
            progress={88}
            openTaskCount={2}
          />
          <ProjectCard
            code="DRM-018"
            name="غرفة نوم رئيسية"
            status="PLANNING"
            priority="MEDIUM"
            ownerName="فهد"
            dueDate={days(-30)}
            progress={10}
            openTaskCount={12}
          />
        </div>
      </Section>

      <Section title="Empty States">
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState
            heading="لا توجد مهام لليوم"
            description="استخدم زر + لإضافة مهمة جديدة أو اسحب من القائمة الخلفية."
            action={<button type="button" className="button-primary">إضافة مهمة</button>}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </EmptyState>
          <EmptyState heading="لا توجد مشاريع متطابقة" description="جرّب تغيير عوامل التصفية أو إعادة ضبط البحث." />
        </div>
      </Section>

      <Section title="Skeletons" description="ظهور أثناء التحميل بدلاً من الصفحة الفارغة">
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard lines={5} />
        </div>
        <div className="mt-3 space-y-2">
          <SkeletonRow />
          <SkeletonRow height={64} />
          <SkeletonRow />
        </div>
      </Section>

      <Section title="Toasts و BottomSheet" description="تفاعلية — اضغط الأزرار لتجربتها">
        <InteractiveDemo />
      </Section>
    </main>
  );
}
