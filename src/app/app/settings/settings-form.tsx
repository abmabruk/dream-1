"use client";

import { useActionState } from "react";

import type { FactorySettingsSnapshot } from "@/modules/settings/settings.schemas";

import {
  initialSettingsActionState,
  updateFactorySettingsAction,
} from "./actions";

export function SettingsForm({
  settings,
}: {
  settings: FactorySettingsSnapshot;
}) {
  const [state, formAction, pending] = useActionState(
    updateFactorySettingsAction,
    initialSettingsActionState
  );

  return (
    <form action={formAction} className="panel space-y-5">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Factory profile
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Core settings</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">
          These settings affect new order codes, portal branding, displayed
          currency, and factory identity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium" htmlFor="name">
            Factory name
          </label>
          <input className="input-field" defaultValue={settings.name} id="name" name="name" required />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="timezone">
            Timezone
          </label>
          <input
            className="input-field"
            defaultValue={settings.timezone}
            id="timezone"
            name="timezone"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="currency">
            Currency
          </label>
          <input
            className="input-field"
            defaultValue={settings.currency}
            id="currency"
            maxLength={3}
            name="currency"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="orderCodePrefix">
            Order code prefix
          </label>
          <input
            className="input-field"
            defaultValue={settings.orderCodePrefix}
            id="orderCodePrefix"
            maxLength={8}
            name="orderCodePrefix"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="portalDisplayName">
            Portal display name
          </label>
          <input
            className="input-field"
            defaultValue={settings.portalDisplayName ?? ""}
            id="portalDisplayName"
            name="portalDisplayName"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="supportEmail">
            Support email
          </label>
          <input
            className="input-field"
            defaultValue={settings.supportEmail ?? ""}
            id="supportEmail"
            name="supportEmail"
            type="email"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="supportPhone">
            Support phone
          </label>
          <input
            className="input-field"
            defaultValue={settings.supportPhone ?? ""}
            id="supportPhone"
            name="supportPhone"
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {state.message && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.message}
        </p>
      )}

      <button className="button-primary disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
