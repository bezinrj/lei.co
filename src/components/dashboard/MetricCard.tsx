type Tone = "sage" | "blush" | "lilac" | "sky";

const toneMap: Record<Tone, string> = {
  sage: "var(--sage)",
  blush: "var(--blush)",
  lilac: "var(--lilac)",
  sky: "var(--sky)",
};

type MetricCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone: Tone;
};

export function MetricCard({ label, value, hint, tone }: MetricCardProps) {
  return (
    <div
      className="lei-card relative overflow-hidden"
      style={{ borderTop: `3px solid ${toneMap[tone]}` }}
    >
      <div className="text-[11px] uppercase tracking-wider text-text-muted mb-2">
        {label}
      </div>
      <div className="font-serif text-[28px] text-text-main leading-none">{value}</div>
      {hint && <div className="mt-2 text-[12px] text-text-muted">{hint}</div>}
    </div>
  );
}
