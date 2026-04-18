import { useState } from "react";

type Bar = { day: string; horas: number; questoes: number };

const data: Bar[] = [
  { day: "Seg", horas: 3.2, questoes: 48 },
  { day: "Ter", horas: 4.1, questoes: 62 },
  { day: "Qua", horas: 2.5, questoes: 35 },
  { day: "Qui", horas: 5.0, questoes: 80 },
  { day: "Sex", horas: 3.8, questoes: 55 },
  { day: "Sáb", horas: 6.2, questoes: 95 },
  { day: "Dom", horas: 1.5, questoes: 20 },
];

type Tab = "horas" | "questoes";

export function WeeklyPerformance() {
  const [tab, setTab] = useState<Tab>("horas");
  const values = data.map((d) => (tab === "horas" ? d.horas : d.questoes));
  const max = Math.max(...values);

  return (
    <div className="lei-card flex flex-col h-full">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-serif text-[15px] text-text-main">Desempenho semanal</h3>
        <div className="flex bg-muted rounded-full p-1 text-[11px]">
          {(["horas", "questoes"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-full transition-colors ${
                tab === t
                  ? "bg-card text-text-main shadow-sm"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {t === "horas" ? "Horas" : "Questões"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-end gap-3 min-h-[160px]">
        {data.map((d, i) => {
          const v = tab === "horas" ? d.horas : d.questoes;
          const h = (v / max) * 100;
          const shades = [
            "var(--sage-light)",
            "var(--sage)",
            "var(--sage-dark)",
          ];
          const color = shades[i % shades.length];
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end h-[140px]">
                <div
                  className="w-full rounded-t-[8px] transition-all"
                  style={{ height: `${h}%`, backgroundColor: color }}
                  title={`${v}`}
                />
              </div>
              <span className="text-[11px] text-text-muted">{d.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
