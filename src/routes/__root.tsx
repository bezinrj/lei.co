import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { usePresence } from "@/hooks/usePresence";

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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lei.co — Mantenha a constância" },
      { name: "description", content: "Cronograma para concurseiros das carreiras de alto nível. Acompanhe horas, questões, medalhas, grupos e ranking." },
      { name: "author", content: "Lei.co" },
      { property: "og:title", content: "Lei.co — Mantenha a constância" },
      { property: "og:description", content: "Cronograma para concurseiros das carreiras de alto nível. Acompanhe horas, questões, medalhas, grupos e ranking." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lei.co — Mantenha a constância" },
      { name: "twitter:description", content: "Cronograma para concurseiros das carreiras de alto nível. Acompanhe horas, questões, medalhas, grupos e ranking." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fe4c632c-5923-4167-8ebb-0c9789549835/id-preview-538827a8--e14d93ea-107e-4f17-925f-9e4674dc8195.lovable.app-1776527768331.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fe4c632c-5923-4167-8ebb-0c9789549835/id-preview-538827a8--e14d93ea-107e-4f17-925f-9e4674dc8195.lovable.app-1776527768331.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
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
  return (
    <AuthProvider>
      <PresenceTracker />
      <Outlet />
      <ClientOnlyToaster />
    </AuthProvider>
  );
}
