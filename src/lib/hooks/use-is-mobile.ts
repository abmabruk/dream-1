"use client";

/**
 * useIsMobile — hydration-safe boolean indicating the viewport is below
 * the `md` breakpoint (767px and under). Returns `false` on the server and
 * during the very first client render, then updates after mount. Used to
 * switch between desktop modal and mobile BottomSheet variants, and to
 * gate other touch-only behaviour.
 */

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(mq.matches);
    update();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    // Safari < 14 fallback
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  return isMobile;
}
