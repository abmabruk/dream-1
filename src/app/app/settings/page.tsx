import { requirePermission } from "@/modules/auth/guards";
import { SettingsService } from "@/modules/settings/settings.service";

import { SettingsForm } from "./settings-form";

const settingsService = new SettingsService();

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
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
          Settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Factory configuration</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          Manage the factory identity, order numbering, currency, and customer
          portal branding from one place.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <SettingsForm settings={settings} />

        <div className="space-y-6">
          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Current workspace
            </p>
            <div className="mt-5 space-y-3 text-sm">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                <span className="text-[var(--muted-foreground)]">Factory:</span>{" "}
                {settings.name}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                <span className="text-[var(--muted-foreground)]">Slug:</span>{" "}
                {settings.slug}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                <span className="text-[var(--muted-foreground)]">Created:</span>{" "}
                {formatDate(settings.createdAt)}
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3">
                <span className="text-[var(--muted-foreground)]">Last updated:</span>{" "}
                {formatDate(settings.updatedAt)}
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Previews
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                <p className="text-sm text-[var(--muted-foreground)]">Next order code</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {settings.previews.nextOrderCode}
                </h2>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                <p className="text-sm text-[var(--muted-foreground)]">Portal display</p>
                <h2 className="mt-2 text-2xl font-semibold">
                  {settings.previews.portalDisplayNameResolved}
                </h2>
              </div>
            </div>
          </article>

          <article className="panel">
            <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
              Live footprint
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                <p className="text-sm text-[var(--muted-foreground)]">Orders in workspace</p>
                <h2 className="mt-2 text-3xl font-semibold">{settings.stats.totalOrders}</h2>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4">
                <p className="text-sm text-[var(--muted-foreground)]">Active users</p>
                <h2 className="mt-2 text-3xl font-semibold">{settings.stats.activeUsers}</h2>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
