"use client";

import { useState } from "react";

import {
  BottomSheet,
  ToastProvider,
  useToast,
} from "@/components/ui";

function ToastButtons() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className="button-secondary"
        onClick={() => toast("تم حفظ المهمة بنجاح", "success")}
      >
        toast: success
      </button>
      <button
        type="button"
        className="button-secondary"
        onClick={() => toast("تعذّر الاتصال بالخادم", "error")}
      >
        toast: error
      </button>
      <button
        type="button"
        className="button-secondary"
        onClick={() => toast("نُقلت 3 مهام إلى اليوم", "info")}
      >
        toast: info
      </button>
    </div>
  );
}

function SheetButtons() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button-primary"
        onClick={() => setOpen(true)}
      >
        افتح BottomSheet
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="تفاصيل المهمة"
      >
        <p className="text-sm leading-7 text-[var(--muted-foreground)]">
          هذه شريحة سفلية على الجوال وتتحول إلى Modal مركزي على الشاشات الكبيرة.
          اضغط Escape أو خارج الشريحة للإغلاق.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="button-primary"
            onClick={() => setOpen(false)}
          >
            تم
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

export function InteractiveDemo() {
  return (
    <ToastProvider>
      <div className="flex flex-wrap items-center gap-3">
        <ToastButtons />
        <SheetButtons />
      </div>
    </ToastProvider>
  );
}
