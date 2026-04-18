import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/grupos")({
  head: () => ({ meta: [{ title: "Grupos — Lei.co" }] }),
  component: () => (
    <AppShell title="Grupos">
      <div className="lei-card text-center py-16">
        <div className="font-serif text-[20px] mb-2">Em breve</div>
        <p className="text-text-muted text-[13px]">Grupos e amigos chegam na próxima iteração.</p>
      </div>
    </AppShell>
  ),
});
