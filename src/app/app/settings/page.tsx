import { requirePermission } from "@/modules/auth/guards";
import { SettingsService } from "@/modules/settings/settings.service";

import { SettingsForm } from "./settings-form";

const settingsService = new SettingsService();

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default async function SettingsPage() {
  const session = await requirePermission("settings:manage");
  const settings = await settingsService.get(session.factoryId);

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          الإعدادات
        </p>
        <h1 className="mt-3 text-3xl font-semibold">إعدادات المصنع</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          أدر هوية المصنع وترقيم الطلبات والعملة وعلامة بوابة العملاء التجارية من مكان واحد.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SettingsForm settings={settings} />

        <div className="space-y-6">
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              مساحة العمل الحالية
            </p>
            <div className="mt-5 space-y-3 text-sm">
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 select-all cursor-text">
                <span className="text-[var(--muted-foreground)]">المصنع:</span>{" "}
                {settings.name}
              </div>
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 select-all cursor-text">
                <span className="text-[var(--muted-foreground)]">الرمز المختصر:</span>{" "}
                {settings.slug}
              </div>
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 select-all cursor-text">
                <span className="text-[var(--muted-foreground)]">تاريخ الإنشاء:</span>{" "}
                {formatDate(settings.createdAt)}
              </div>
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 select-all cursor-text">
                <span className="text-[var(--muted-foreground)]">آخر تحديث:</span>{" "}
                {formatDate(settings.updatedAt)}
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              معاينات
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                <p className="text-sm text-[var(--muted-foreground)]">رمز الطلب التالي</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {settings.previews.nextOrderCode}
                </h2>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                <p className="text-sm text-[var(--muted-foreground)]">عرض البوابة</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {settings.previews.portalDisplayNameResolved}
                </h2>
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              البصمة الحية
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                <p className="text-sm text-[var(--muted-foreground)]">الطلبات في مساحة العمل</p>
                <h2 className="mt-2 text-3xl font-semibold">{settings.stats.totalOrders}</h2>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                <p className="text-sm text-[var(--muted-foreground)]">المستخدمون النشطون</p>
                <h2 className="mt-2 text-3xl font-semibold">{settings.stats.activeUsers}</h2>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
