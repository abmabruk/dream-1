"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { useToast } from "@/components/ui";

export function ImportProjectButton() {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        toast("الملف ليس JSON صالحًا", "error");
        return;
      }
      const r = await fetch("/api/v1/projects/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const p = (await r.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(p?.error?.message || "فشل الاستيراد.");
      }
      toast("✓ تم استيراد المشروع", "success");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "تعذّر الاستيراد", "error");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button
        type="button"
        className="button-secondary"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {busy ? "..." : "استيراد مشروع"}
      </button>
    </>
  );
}
