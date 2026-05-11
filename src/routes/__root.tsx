import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { usePresence } from "@/hooks/usePresence";
import { useLastSeen } from "@/hooks/useLastSeen";
import { PWARegister } from "@/components/PWARegister";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Lei.co — Mantenha a constância" },
      { name: "theme-color", content: "#B8C9B0" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Lei.co" },
      { name: "description", content: "Cronograma para concurseiros das carreiras de alto nível. Acompanhe horas, questões, medalhas, grupos e ranking." },
      { name: "author", content: "Lei.co" },
      { property: "og:title", content: "Lei.co — Mantenha a constância" },
      { property: "og:description", content: "Cronograma para concurseiros das carreiras de alto nível. Acompanhe horas, questões, medalhas, grupos e ranking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lei.co — Mantenha a constância" },
      { name: "twitter:description", content: "Cronograma para concurseiros das carreiras de alto nível. Acompanhe horas, questões, medalhas, grupos e ranking." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/3uYPLr1bzPXPp4gqHgJFkk354o02/social-images/social-1778537989640-1.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/3uYPLr1bzPXPp4gqHgJFkk354o02/social-images/social-1778537989640-1.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function PresenceTracker() {
  usePresence();
  useLastSeen();
  return null;
}

function ClientOnlyToaster() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <Toaster />;
}

function RootComponent() {
  // Fresh QueryClient per request — prevents data leaking between SSR requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PresenceTracker />
        <PWARegister />
        <Outlet />
        <ClientOnlyToaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
