import { redirect } from "next/navigation";

import { getSession } from "@/modules/auth/session";

import { CustomerSignInForm } from "./sign-in-form";

export const dynamic = "force-dynamic";

export default async function PortalLoginPage() {
  const session = await getSession();

  if (session) {
    if (session.role === "CUSTOMER") {
      redirect("/portal/dashboard");
    }
    // Internal users shouldn't end up here, but bounce them to /app
    // rather than show a customer-facing form.
    redirect("/app");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-6 py-16">
      <section className="panel w-full">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          بوابة العملاء
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          تسجيل الدخول إلى حساب العميل
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted-foreground)]">
          أدخل بريدك الإلكتروني وكلمة المرور للاطلاع على طلباتك وفواتيرك.
        </p>
        <CustomerSignInForm />
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          إذا لم تستلم بيانات الدخول بعد، تواصل مع فريق المبيعات لدى المصنع.
        </p>
      </section>
    </main>
  );
}
