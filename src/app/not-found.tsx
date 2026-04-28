import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          ٤٠٤
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          الصفحة غير موجودة
        </h1>
        <p className="mx-auto max-w-md text-base leading-7 text-[var(--muted-foreground)]">
          الرابط اللي دخلت عليه غير صحيح أو حُذفت الصفحة.
        </p>
      </div>
      <Link href="/app" className="button-primary">
        العودة للصفحة الرئيسية
      </Link>
    </main>
  );
}
