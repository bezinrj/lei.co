// Cores determinísticas por matéria.
// Normaliza o nome (lowercase, sem acento) e mapeia por palavras-chave.
//
// Retornamos dois conjuntos:
//  - SOLID: cor forte (usada em pills do calendário, bolinhas de legenda,
//    coluna `cor` salva no banco, cor de evento etc.).
//  - PASTEL: { background, color } usados nos BADGES de matéria em todo o
//    sistema (matriz, legenda do calendário, modal de detalhes, modal de
//    sessão, painel de desempenho).

export type MateriaPastel = { background: string; color: string };

function normalize(materia: string): string {
  return (materia || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Cor SÓLIDA da matéria (uso legado: pills do calendário, dot de legenda, etc). */
export function getCorMateria(materia: string): string {
  const m = normalize(materia);
  if (m.includes("constitucional")) return "#1D9E75";
  if (m.includes("processo civil") || m.includes("processual civil")) return "#BA7517";
  if (m.includes("civil") && !m.includes("processo") && !m.includes("processual"))
    return "#378ADD";
  if (m.includes("processo penal") || m.includes("processual penal")) return "#E24B4A";
  if (m.includes("penal") && !m.includes("processo") && !m.includes("processual"))
    return "#D85A30";
  if (m.includes("administrativo")) return "#7F77DD";
  if (m.includes("empresarial")) return "#D4537E";
  if (m.includes("revisao")) return "#6B7280";
  if (m.includes("simulado")) return "#888780";
  return "#888780";
}

/** Cor PASTEL para BADGES de matéria — fundo claro + texto escuro da mesma família. */
export function getCorMateriaPastel(materia: string): MateriaPastel {
  const m = normalize(materia);
  if (m.includes("constitucional"))
    return { background: "#E1F5EE", color: "#085041" };
  if (m.includes("processo civil") || m.includes("processual civil"))
    return { background: "#FAEEDA", color: "#412402" };
  if (m.includes("civil") && !m.includes("processo") && !m.includes("processual"))
    return { background: "#E6F1FB", color: "#042C53" };
  if (m.includes("processo penal") || m.includes("processual penal"))
    return { background: "#FCEBEB", color: "#501313" };
  if (m.includes("penal") && !m.includes("processo") && !m.includes("processual"))
    return { background: "#FAECE7", color: "#4A1B0C" };
  if (m.includes("administrativo"))
    return { background: "#EEEDFE", color: "#26215C" };
  if (m.includes("empresarial"))
    return { background: "#FBEAF0", color: "#4B1528" };
  if (m.includes("revisao"))
    return { background: "#F1EFE8", color: "#444441" };
  if (m.includes("simulado"))
    return { background: "#F1EFE8", color: "#444441" };
  return { background: "#F1EFE8", color: "#444441" };
}

/**
 * Mantido para retrocompatibilidade. Retorna a cor SÓLIDA derivada do nome
 * (o segundo argumento é ignorado).
 */
export function colorForMateria(nome: string, _stored?: string | null): string {
  return getCorMateria(nome);
}
