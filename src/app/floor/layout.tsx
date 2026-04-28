import "./floor.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "شاشة المصنع",
  description: "عرض حي لمحطة الإنتاج — للعرض على الشاشة الكبيرة في صالة المصنع.",
};

/**
 * Minimal full-screen layout for the factory floor kiosk.
 * Inherits `lang="ar"` and `dir="rtl"` from the root layout.
 * Intentionally has no sidebar, no nav, no chrome — just the display.
 */
export default function FloorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <div className="floor-root">{children}</div>;
}
