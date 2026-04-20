// Cores determinísticas por matéria.
// Normaliza o nome (lowercase, sem acento) e mapeia por palavras-chave.
export function getCorMateria(materia: string): string {
  const m = (materia || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (m.includes("constitucional")) return "#1D9E75";
  if (m.includes("civil") && !m.includes("processo") && !m.includes("processual"))
    return "#378ADD";
  if (m.includes("processo civil") || m.includes("processual civil")) return "#BA7517";
  if (m.includes("penal") && !m.includes("processo") && !m.includes("processual"))
    return "#D85A30";
  if (m.includes("processo penal") || m.includes("processual penal")) return "#E24B4A";
  if (m.includes("administrativo")) return "#7F77DD";
  if (m.includes("empresarial")) return "#D4537E";
  if (m.includes("revisao")) return "#6B7280";
  if (m.includes("simulado")) return "#888780";

  return "#888780";
}

/**
 * Mantido para retrocompatibilidade com chamadas existentes.
 * IMPORTANTE: o valor armazenado é IGNORADO — a cor é sempre derivada
 * deterministicamente do nome da matéria.
 */
export function colorForMateria(nome: string, _stored?: string | null): string {
  return getCorMateria(nome);
}
