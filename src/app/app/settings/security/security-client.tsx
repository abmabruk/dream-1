"use client";

import { useState } from "react";

type Stage =
  | "idle"
  | "enrolling" // calling /setup
  | "verify" // showing QR + waiting for confirm
  | "done" // recovery codes shown after enrollment confirm
  | "disabling";

type SetupResponse = {
  ok: true;
  data: {
    secret: string;
    qrCodeDataUrl: string;
    recoveryCodes: string[];
  };
};

type ApiFail = { ok: false; error: { message: string } };

export function SecurityClient(props: {
  email: string;
  enabled: boolean;
  enabledAt: string | null;
  remainingRecoveryCodes: number;
}) {
  const [enabled, setEnabled] = useState(props.enabled);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [qrUrl, setQrUrl] = useState<string>("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");

  async function startSetup() {
    setError(null);
    setStage("enrolling");
    try {
      const res = await fetch("/api/v1/auth/2fa/setup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const json = (await res.json()) as SetupResponse | ApiFail;
      if (!json.ok) {
        setError(json.error.message || "تعذّر بدء الإعداد.");
        setStage("idle");
        return;
      }
      setSecret(json.data.secret);
      setQrUrl(json.data.qrCodeDataUrl);
      setRecoveryCodes(json.data.recoveryCodes);
      setStage("verify");
    } catch {
      setError("تعذّر الاتصال بالخادم.");
      setStage("idle");
    }
  }

  async function confirmSetup() {
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, mode: "setup" }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { enabled: true } }
        | ApiFail;
      if (!json.ok) {
        setError(json.error.message || "الرمز غير صحيح.");
        return;
      }
      setEnabled(true);
      setStage("done");
      setCode("");
    } catch {
      setError("تعذّر الاتصال بالخادم.");
    }
  }

  async function disable() {
    setError(null);
    try {
      const res = await fetch("/api/v1/auth/2fa/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      const json = (await res.json()) as
        | { ok: true; data: { enabled: false } }
        | ApiFail;
      if (!json.ok) {
        setError(json.error.message || "تعذّر التعطيل.");
        return;
      }
      setEnabled(false);
      setStage("idle");
      setSecret("");
      setQrUrl("");
      setRecoveryCodes([]);
      setDisableCode("");
    } catch {
      setError("تعذّر الاتصال بالخادم.");
    }
  }

  function downloadCodes() {
    const text = [
      `رموز الاسترداد لحساب ${props.email}`,
      `أُنشئت في: ${new Date().toLocaleString("ar-SA")}`,
      "",
      "احتفظ بهذه الرموز في مكان آمن. كل رمز يُستخدم مرة واحدة.",
      "",
      ...recoveryCodes,
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dream1-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Already enabled (and not in middle of disabling) ──────
  if (enabled && stage !== "done") {
    return (
      <section className="panel space-y-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          المصادقة الثنائية مفعّلة
          {props.enabledAt ? ` منذ ${props.enabledAt}` : ""}.
        </div>

        <p className="text-sm text-[var(--muted-foreground)]">
          رموز الاسترداد المتبقية: {props.remainingRecoveryCodes}
        </p>

        <div className="space-y-3">
          <p className="text-sm font-medium">تعطيل المصادقة الثنائية</p>
          <p className="text-sm text-[var(--muted-foreground)]">
            أدخل رمزاً حالياً مكوّناً من ٦ أرقام من تطبيق المصادقة لتأكيد
            التعطيل. لا تُقبل رموز الاسترداد هنا لأسباب أمنية.
          </p>
          <input
            className="input-field tracking-[0.4em] text-center font-mono"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            placeholder="••••••"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
          />
          {error && (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={disable}
            className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100"
          >
            تعطيل
          </button>
        </div>
      </section>
    );
  }

  // ── Just-finished enrollment: show recovery codes ─────────
  if (stage === "done") {
    return (
      <section className="panel space-y-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          تم تفعيل المصادقة الثنائية بنجاح.
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">
            رموز الاسترداد (تظهر مرة واحدة فقط)
          </p>
          <p className="text-sm text-[var(--muted-foreground)]">
            احفظ هذه الرموز في مكان آمن — تستطيع استخدامها لتسجيل الدخول إذا
            فقدت جهاز المصادقة. كل رمز يُستخدم مرة واحدة.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 font-mono text-sm">
            {recoveryCodes.map((c) => (
              <li
                key={c}
                className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-2 select-all"
              >
                {c}
              </li>
            ))}
          </ul>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={downloadCodes}
              className="button-primary"
            >
              تحميل الرموز
            </button>
            <button
              type="button"
              onClick={() => {
                setStage("idle");
                setRecoveryCodes([]);
              }}
              className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--panel-strong)]"
            >
              تم
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── Verify step: QR + code input ──────────────────────────
  if (stage === "verify") {
    return (
      <section className="panel space-y-5">
        <p className="text-sm font-medium">امسح الرمز ضوئياً</p>
        <p className="text-sm text-[var(--muted-foreground)]">
          استخدم تطبيق مثل Google Authenticator أو 1Password أو Authy لمسح الرمز
          أدناه، ثم أدخل الرمز المكوَّن من ٦ أرقام لتأكيد التفعيل.
        </p>

        {qrUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrUrl}
            alt="رمز QR"
            className="rounded-2xl border border-[var(--border)] bg-white p-3"
            width={220}
            height={220}
          />
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-[var(--muted-foreground)]">
            لا أستطيع المسح — أظهر السر يدوياً
          </summary>
          <p className="mt-3 break-all rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] px-4 py-3 font-mono text-xs select-all">
            {secret}
          </p>
        </details>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="totp-code">
            رمز التحقق
          </label>
          <input
            id="totp-code"
            className="input-field tracking-[0.4em] text-center font-mono"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="••••••"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
        </div>

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={confirmSetup}
            className="button-primary"
          >
            تأكيد التفعيل
          </button>
          <button
            type="button"
            onClick={() => {
              setStage("idle");
              setSecret("");
              setQrUrl("");
              setRecoveryCodes([]);
              setCode("");
              setError(null);
            }}
            className="rounded-2xl border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--panel-strong)]"
          >
            إلغاء
          </button>
        </div>
      </section>
    );
  }

  // ── Idle / not enabled ────────────────────────────────────
  return (
    <section className="panel space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        المصادقة الثنائية غير مفعلة لحسابك.
      </div>

      <p className="text-sm text-[var(--muted-foreground)]">
        عند التفعيل سنطلب منك رمزاً من تطبيق المصادقة بعد إدخال كلمة المرور عند
        كل تسجيل دخول.
      </p>

      {error && (
        <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={startSetup}
        className="button-primary disabled:opacity-60"
        disabled={stage === "enrolling"}
      >
        {stage === "enrolling" ? "جاري الإعداد..." : "تفعيل المصادقة الثنائية"}
      </button>
    </section>
  );
}
