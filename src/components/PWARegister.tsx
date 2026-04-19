import { useEffect } from "react";

/**
 * Registers the service worker only in production-like environments and
 * NEVER inside Lovable preview iframes (which would break hot reload and
 * cache stale builds). Also actively unregisters any existing SW when
 * running inside the editor preview.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const isInIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    const host = window.location.hostname;
    const isPreviewHost =
      host.includes("id-preview--") ||
      host.includes("lovableproject.com") ||
      host.includes("lovable.app") === false && host === "localhost";

    if (isInIframe || host.includes("id-preview--") || host.includes("lovableproject.com")) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }

    // Dynamic import via variable + @vite-ignore so Vite does NOT try to
    // resolve the virtual module in dev (it only exists in production builds).
    const moduleName = "virtual:pwa-register";
    import(/* @vite-ignore */ moduleName)
      .then((mod: { registerSW: (opts: { immediate: boolean }) => void }) => {
        mod.registerSW({ immediate: true });
      })
      .catch(() => {
        /* PWA plugin not built yet (dev) — ignore */
      });

    // Reference unused var to satisfy linter
    void isPreviewHost;
  }, []);

  return null;
}
