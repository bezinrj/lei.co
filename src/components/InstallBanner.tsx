import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "leico_install_dismissed";

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed (standalone display mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    if (localStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
    }

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      localStorage.setItem(DISMISS_KEY, "1");
    };

    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || !deferred) return null;

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-50 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.08)] border-t border-border"
      style={{
        bottom: "calc(64px + env(safe-area-inset-bottom))",
        paddingBottom: "12px",
        paddingTop: "12px",
        paddingLeft: "16px",
        paddingRight: "16px",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 text-[13px] text-text-main leading-snug">
          Estude em qualquer lugar —
        </div>
        <button
          onClick={async () => {
            try {
              await deferred.prompt();
              const choice = await deferred.userChoice;
              if (choice.outcome === "accepted") {
                setInstalled(true);
                localStorage.setItem(DISMISS_KEY, "1");
              }
              setDeferred(null);
            } catch {
              setDeferred(null);
            }
          }}
          className="inline-flex items-center gap-1 text-white text-[12px] font-medium px-4 h-9 whitespace-nowrap"
          style={{ background: "#B8C9B0", borderRadius: 20 }}
        >
          <Download size={14} /> Instalar o Lei.co App
        </button>
        <button
          onClick={() => {
            setDismissed(true);
            localStorage.setItem(DISMISS_KEY, "1");
          }}
          aria-label="Fechar"
          className="text-text-muted hover:text-text-main p-1"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
