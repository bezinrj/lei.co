import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/medalhas")({
  head: () => ({ meta: [{ title: "Medalhas — Lei.co" }] }),
  component: () => (
    <AppShell title="Medalhas">
      <div className="lei-card text-center py-16">
        <div className="font-serif text-[20px] mb-2">Em breve</div>
        <p className="text-text-muted text-[13px]">A galeria de medalhas chega na próxima iteração.</p>
      </div>
    </AppShell>
  ),
});
