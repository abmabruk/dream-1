import Link from "next/link";

import { signOutAction } from "@/app/sign-in/actions";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-6 py-16">
      <section className="panel w-full">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          التحكم في الوصول
        </p>
        <h1 className="mt-3 text-3xl font-semibold">ليس لديك صلاحية للوصول إلى هذه المنطقة.</h1>
        <div className="mt-6 flex items-center gap-3">
          <Link className="button-secondary" href="/worker">
            بوابة العامل
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="button-secondary">
              تسجيل الخروج
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
