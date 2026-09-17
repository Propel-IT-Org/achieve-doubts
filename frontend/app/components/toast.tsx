import { Toaster as SonnerToaster } from "sonner";

/**
 * Sonner, dressed as the prototype's `flash()`: one navy toast centred above
 * the bottom nav. Call `toast(...)` / `toast.error(...)` from "sonner"
 * anywhere. Rendered inside `.acs` so the design tokens resolve.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      visibleToasts={1}
      duration={2800}
      offset={24}
      mobileOffset={{ bottom: "calc(var(--bnav-h) + var(--safe-b) + 12px)" }}
      toastOptions={{ unstyled: true, classNames: { toast: "acs-toast" } }}
    />
  );
}
