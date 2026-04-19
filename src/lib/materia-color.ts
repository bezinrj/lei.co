// Deterministic color from materia name (12-color palette)
const PALETTE = [
  "#1D9E75", "#378ADD", "#D85A30", "#9B59B6",
  "#E67E22", "#2ECC71", "#E74C3C", "#1ABC9C",
  "#3498DB", "#F39C12", "#8E44AD", "#16A085",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function colorForMateria(nome: string, stored?: string | null): string {
  if (stored && stored.startsWith("#")) return stored;
  return PALETTE[hash(nome.toLowerCase()) % PALETTE.length];
}
