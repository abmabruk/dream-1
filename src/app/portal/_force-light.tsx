"use client";

import { useEffect } from "react";

/**
 * Removes `.dark` from <html> while the portal segment is mounted, and
 * restores the prior class on unmount. Customer-facing portal pages stay
 * light regardless of any internal user's localStorage preference on the
 * same device.
 */
export function PortalLightLock() {
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    if (wasDark) root.classList.remove("dark");
    return () => {
      if (wasDark) root.classList.add("dark");
    };
  }, []);
  return null;
}
