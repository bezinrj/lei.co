type Member = {
  name: string;
  score: number;
  isMe?: boolean;
};

const members: Member[] = [
  { name: "Joana R.", score: 980 },
  { name: "Pedro M.", score: 870 },
  { name: "Maria (você)", score: 815, isMe: true },
  { name: "Lucas T.", score: 720 },
  { name: "Ana C.", score: 640 },
];

const palette = [
  "var(--sage)",
  "var(--blush)",
  "var(--lilac)",
  "var(--sky)",
  "var(--sage-light)",
];

export function GroupRanking() {
  const max = Math.max(...members.map((m) => m.score));
  return (
    <div className="lei-card h-full">
      <h3 className="font-serif text-[15px] text-text-main mb-4">Ranking do grupo</h3>
      <ul className="flex flex-col gap-3">
        {members.map((m, i) => {
          const pct = (m.score / max) * 100;
          return (
            <li key={m.name} className="flex items-center gap-3">
              <span className="w-5 text-[11px] text-text-muted font-medium">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-[12px] truncate ${
                      m.isMe ? "text-sage-dark font-medium" : "text-text-main"
                    }`}
                  >
                    {m.name} {m.isMe && <span className="text-sage-dark">←</span>}
                  </span>
                  <span className="text-[11px] text-text-muted ml-2">{m.score}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: palette[i] }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
