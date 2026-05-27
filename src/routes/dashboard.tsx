import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Lei.co" },
      { name: "description", content: "Acompanhe horas, questões, desempenho e ranking no Lei.co." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();
  if (!user) {
    return (
      <AppShell title="Dashboard">
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="animate-spin mr-2" size={18} /> Carregando…
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell title="Dashboard">
      <DashboardView userId={user.id} />
    </AppShell>
  );
}
