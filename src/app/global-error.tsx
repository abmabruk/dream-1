"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#ffffff",
          color: "#0f172a",
        }}
      >
        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
          خطأ في النظام
        </h1>
        <p style={{ fontSize: "1rem", color: "#64748b", marginBottom: "1.5rem" }}>
          صار خطأ في تحميل التطبيق. الرجاء المحاولة مرة أخرى.
        </p>
        {error.digest ? (
          <p style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "1.5rem" }}>
            معرّف الخطأ: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            padding: "0.75rem 1.5rem",
            background: "#0f766e",
            color: "#ffffff",
            border: 0,
            borderRadius: "9999px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          إعادة المحاولة
        </button>
      </body>
    </html>
  );
}
