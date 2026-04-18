type Status = "concluido" | "em-breve" | "pendente";

type Block = {
  subject: string;
  time: string;
  color: string;
  status: Status;
};

const blocks: Block[] = [
  { subject: "Direito Constitucional", time: "07:00 — 08:30", color: "var(--sage)", status: "concluido" },
  { subject: "Português", time: "09:00 — 10:00", color: "var(--blush)", status: "concluido" },
  { subject: "Raciocínio Lógico", time: "14:00 — 15:30", color: "var(--lilac)", status: "em-breve" },
  { subject: "Revisão semanal", time: "20:00 — 21:00", color: "var(--sky)", status: "pendente" },
];

const statusStyle: Record<Status, { label: string; bg: string; fg: string }> = {
  concluido: { label: "Concluído", bg: "var(--sage-light)", fg: "var(--sage-dark)" },
  "em-breve": { label: "Em breve", bg: "var(--sky-light)", fg: "oklch(0.45 0.06 235)" },
  pendente: { label: "Pendente", bg: "var(--blush-light)", fg: "oklch(0.5 0.1 25)" },
};

export function TodaySchedule() {
  return (
    <div className="lei-card h-full">
      <h3 className="font-serif text-[15px] text-text-main mb-4">Hoje no cronograma</h3>
      <ul className="flex flex-col gap-3">
        {blocks.map((b) => {
          const s = statusStyle[b.status];
          return (
            <li
              key={b.subject}
              className="flex items-center gap-3 py-2 border-b border-border last:border-b-0"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: b.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-text-main truncate">{b.subject}</div>
                <div className="text-[11px] text-text-muted">{b.time}</div>
              </div>
              <span
                className="text-[10px] px-2 py-1 rounded-[10px] font-medium whitespace-nowrap"
                style={{ backgroundColor: s.bg, color: s.fg }}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
