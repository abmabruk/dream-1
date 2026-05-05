import { redirect } from "next/navigation";

import { getSession } from "@/modules/auth/session";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const session = await getSession();

  if (session) {
    if (session.role === "CUSTOMER") {
      redirect("/portal/dashboard");
    }
    if (session.role === "WORKER") {
      redirect("/worker");
    }
    redirect("/app");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-6 py-16">
      <section className="panel w-full">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          بوابة الدخول
        </p>
        <h1 className="mt-3 text-3xl font-semibold">
          تسجيل الدخول إلى Dream 1
        </h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted-foreground)]">
          أدخل بياناتك للوصول إلى منطقة التطبيق المحمية.
        </p>
        <SignInForm />
        <p className="mt-6 text-sm text-[var(--muted-foreground)]">
          إذا نسيت كلمة المرور، اتصل بمسؤول النظام.
        </p>
      </section>
    </main>
  );
}
