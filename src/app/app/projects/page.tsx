import Link from "next/link";

import { requirePermission } from "@/modules/auth/guards";
import { hasPermission } from "@/modules/auth/roles";
import { OrderService } from "@/modules/orders/order.service";
import { ProjectService } from "@/modules/projects/project.service";
import { UserService } from "@/modules/users/user.service";
import { EmptyState, MetricCard } from "@/components/ui";
import { formatNumber } from "@/lib/format";

import { CreateProjectForm } from "./create-project-form";
import { ImportProjectButton } from "./import-project-button";
import { ProjectsList } from "./projects-list";

const projectService = new ProjectService();
const orderService = new OrderService();
const userService = new UserService();

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ProjectsPage() {
  const session = await requirePermission("projects:view");
  const canManage = hasPermission(session.role, "projects:manage");
  const workDate = todayDate();

  const [projects, orders, users] = await Promise.all([
    projectService.list(session.factoryId, workDate),
    canManage ? orderService.list(session.factoryId) : Promise.resolve([]),
    canManage ? userService.list(session.factoryId) : Promise.resolve([]),
  ]);

  const owners = users.filter((user) =>
    ["OWNER", "FACTORY_MANAGER", "SUPERVISOR", "SALES_MANAGER"].includes(user.role)
  );

  const activeProjects = projects.filter(
    (project) => !["COMPLETED", "CANCELLED"].includes(project.status)
  );

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          المشاريع
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          إدارة المشاريع الداخلية
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          احتفظ بالمشاريع كحاويات نظيفة للعمل. تتعامل لوحة العمليات اليومية مع ما يجب
          تنفيذه اليوم، بينما تحتفظ هذه الصفحة بالصورة الكاملة لكل مشروع.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <MetricCard label="جميع المشاريع" value={formatNumber(projects.length)} />
        <MetricCard label="نشط" tone="accent" value={formatNumber(activeProjects.length)} />
        <MetricCard
          label="بانتظار الموافقة"
          tone="warn"
          value={formatNumber(
            projects.reduce((sum, project) => sum + project.waitingApprovalCount, 0)
          )}
        />
        <MetricCard
          label="مجدول اليوم"
          value={formatNumber(
            projects.reduce((sum, project) => sum + project.queuedTodayCount, 0)
          )}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="panel overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-2xl font-semibold">قائمة المشاريع</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {projects.length} مشاريع مُتتبّعة عبر المصنع
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canManage ? <ImportProjectButton /> : null}
              <Link className="button-secondary" href="/app/ops">
                فتح عمليات اليوم
              </Link>
            </div>
          </div>

          {projects.length === 0 ? (
            <EmptyState
              heading="لا توجد مشاريع بعد"
              description="أنشئ المشروع الأول من النموذج بجانب القائمة وابدأ بإضافة المهام الداخلية."
              variant="compact"
            >
              <svg width="88" height="88" viewBox="0 0 88 88" fill="none" aria-hidden xmlns="http://www.w3.org/2000/svg">
                <rect x="14" y="26" width="60" height="44" rx="8" fill="var(--accent)" fillOpacity="0.10" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="2"/>
                <path d="M14 36 L34 36 L40 28 L74 28" stroke="var(--accent)" strokeOpacity="0.7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <circle cx="44" cy="52" r="9" fill="var(--accent)" fillOpacity="0.20"/>
                <path d="M40 52 L43 55 L48 49" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </EmptyState>
          ) : (
            <ProjectsList
              canManage={canManage}
              initialProjects={projects.map((p) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                status: p.status,
                priority: p.priority,
                ownerName: p.ownerName,
                orderCode: p.orderCode,
                openTaskCount: p.openTaskCount,
                queuedTodayCount: p.queuedTodayCount,
                dueDate: p.dueDate,
                doneTaskCount: p.doneTaskCount,
                totalTaskCount: p.totalTaskCount,
              }))}
            />
          )}
        </article>

        {canManage ? (
          <CreateProjectForm
            orders={orders.map((order) => ({
              id: order.id,
              code: order.code,
              title: order.title,
            }))}
            owners={owners.map((user) => ({
              id: user.id,
              displayName: user.displayName,
              role: user.role,
            }))}
          />
        ) : (
          <section className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              الوصول
            </p>
            <h2 className="mt-2 text-2xl font-semibold">وصول للعرض فقط</h2>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
              يمكن لدورك مراقبة المشاريع، لكن إنشاء المشاريع والتخطيط لها يتم من قبل
              قادة العمليات.
            </p>
          </section>
        )}
      </section>
    </main>
  );
}
