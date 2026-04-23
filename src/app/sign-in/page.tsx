import { redirect } from "next/navigation";

import { getSession } from "@/modules/auth/session";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const session = await getSession();

  if (session) {
    redirect("/app");
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 items-center px-6 py-16">
      <section className="panel w-full">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          Auth entry
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Sign in to Dream 1</h1>
        <p className="mt-4 text-base leading-8 text-[var(--muted-foreground)]">
          The first real auth flow is now wired. Seed the database, then use the
          default owner account to enter the protected application area.
        </p>
        <SignInForm />
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-4 text-sm text-[var(--muted-foreground)]">
          <p>Default seed account</p>
          <p className="mt-2 font-medium text-[var(--foreground)]">owner@dream1.local</p>
          <p className="font-medium text-[var(--foreground)]">dream12345</p>
        </div>
      </section>
    </main>
  );
}
