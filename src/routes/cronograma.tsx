import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/cronograma")({
  head: () => ({ meta: [{ title: "Cronograma — Lei.co" }] }),
  component: () => (
    <AppShell title="Cronograma">
      <div className="lei-card text-center py-16">
        <div className="font-serif text-[20px] mb-2">Em breve</div>
        <p className="text-text-muted text-[13px]">O calendário mensal chega na próxima iteração.</p>
      </div>
    </AppShell>
  ),
});
