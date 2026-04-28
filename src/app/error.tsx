"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("App error:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
          خطأ
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          صار خطأ غير متوقع
        </h1>
        <p className="mx-auto max-w-md text-base leading-7 text-[var(--muted-foreground)]">
          ما قدرنا نكمّل العملية. جرّب من جديد، ولو استمر الخطأ، تواصل مع مسؤول
          النظام.
        </p>
        {error.digest ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            معرّف الخطأ: <code>{error.digest}</code>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="button-primary"
        >
          إعادة المحاولة
        </button>
        <Link href="/app" className="button-secondary">
          العودة للصفحة الرئيسية
        </Link>
      </div>
    </main>
  );
}
