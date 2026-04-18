import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { WeeklyPerformance } from "@/components/dashboard/WeeklyPerformance";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { GroupRanking } from "@/components/dashboard/GroupRanking";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Lei.co" },
      { name: "description", content: "Acompanhe seu desempenho de estudos no Lei.co." },
      { property: "og:title", content: "Dashboard — Lei.co" },
      { property: "og:description", content: "Estude com propósito. Acompanhe horas, questões e medalhas." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AppShell title="Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Horas estudadas" value="26h 15m" hint="esta semana" tone="sage" />
        <MetricCard label="Questões feitas" value="412" hint="78% de acerto" tone="blush" />
        <MetricCard label="Sequência" value="14 dias" hint="seu recorde: 22" tone="lilac" />
        <MetricCard label="Medalhas" value="9 / 24" hint="próxima: Madrugadora" tone="sky" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <WeeklyPerformance />
        </div>
        <div className="lg:col-span-1">
          <TodaySchedule />
        </div>
        <div className="lg:col-span-1">
          <GroupRanking />
        </div>
      </div>
    </AppShell>
  );
}
