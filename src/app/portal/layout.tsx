import { PortalLightLock } from "./_force-light";

/**
 * Customer-portal segment layout.
 *
 * The portal is customer-facing and is intentionally locked to the light
 * theme regardless of the user's stored preference (an unauthenticated
 * customer following an order link should not inherit an internal user's
 * dark-mode choice on a shared device). The lightweight client component
 * below removes the `dark` class from <html> while a portal route is
 * mounted, and restores it on unmount.
 */
export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <PortalLightLock />
      {children}
    </>
  );
}
