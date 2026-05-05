import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getSession } from "@/modules/auth/session";

import { SecurityClient } from "./security-client";

export default async function SecuritySettingsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in?redirect=/app/settings/security");

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      totpEnabled: true,
      totpEnabledAt: true,
      totpRecoveryCodes: true,
    },
  });

  const remaining = user?.totpRecoveryCodes.length ?? 0;
  const enabledAt = user?.totpEnabledAt
    ? new Intl.DateTimeFormat("ar-SA", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(user.totpEnabledAt)
    : null;

  return (
    <main className="space-y-6">
      <section className="panel">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          الأمان
        </p>
        <h1 className="mt-3 text-3xl font-semibold">المصادقة الثنائية</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted-foreground)]">
          أضف طبقة حماية إضافية لحسابك. سيُطلب منك رمز مكوَّن من ٦ أرقام بعد
          إدخال كلمة المرور عند كل تسجيل دخول. ينصح بشدة بتفعيلها للأدوار
          المالية والإدارية.
        </p>
      </section>

      <SecurityClient
        email={session.email}
        enabled={user?.totpEnabled ?? false}
        enabledAt={enabledAt}
        remainingRecoveryCodes={remaining}
      />
    </main>
  );
}
