import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Papa from "papaparse";
import type { AdminUserReport } from "@/server/admin-extra.functions";

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function parseTempoMin(t: string | null | undefined): number {
  if (!t) return 0;
  const parts = t.split(":");
  const h = parseInt(parts[0] ?? "0", 10) || 0;
  const m = parseInt(parts[1] ?? "0", 10) || 0;
  return h * 60 + m;
}

function minToHumanH(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

// ------- CSV (mantém) -------

export function downloadCSV(report: AdminUserReport) {
  const p = report.profile;
  const sections: string[] = [];

  sections.push(
    Papa.unparse({
      fields: ["Campo", "Valor"],
      data: [
        ["Nome", p.display_name ?? ""],
        ["Email", p.email ?? ""],
        ["Telefone", p.telefone ?? ""],
        ["Friend ID", p.friend_id ?? ""],
        ["ID", p.id],
        ["Roles", p.roles.join(", ")],
        ["Plano", p.plano_atual],
        ["Cadastro", fmtDate(p.created_at)],
        ["Última atividade", fmtDate(p.last_seen)],
        ["Bloqueado", p.bloqueado ? "Sim" : "Não"],
        ["Horas estudadas", String(p.metrics.horasEstudadas)],
        ["Questões feitas", String(p.metrics.questoesFeitas)],
        ["% médio acerto", `${p.metrics.acertosMedio}%`],
        ["Streak", String(p.metrics.streak)],
        ["Badges", String(p.metrics.badges)],
      ],
    }),
  );

  sections.push("\n\nProgresso por cronograma\n");
  sections.push(
    Papa.unparse(
      report.cronogramas.map((c) => ({
        Cronograma: c.nome,
        Concluídos: c.concluidos,
        Total: c.total_topicos,
        Percentual: `${c.pct}%`,
      })),
    ),
  );

  sections.push("\n\nProgresso por matéria\n");
  sections.push(
    Papa.unparse(
      report.materias.map((m) => ({
        Cronograma: m.cronograma,
        Matéria: m.nome,
        Concluídos: m.concluidos,
        Total: m.total,
        Percentual: `${m.pct}%`,
      })),
    ),
  );

  sections.push("\n\nHistórico de sessões\n");
  sections.push(
    Papa.unparse(
      report.sessoes.map((s) => ({
        Data: fmtDate(s.data),
        Matéria: s.materia,
        Tópico: s.topico,
        Tempo: s.tempo,
        Questões: s.questoes,
        Acertos: s.acertos,
        Percentual: `${s.pct}%`,
      })),
    ),
  );

  sections.push("\n\nBadges\n");
  sections.push(
    Papa.unparse(
      report.badges.map((b) => ({ Badge: b.nome, Desbloqueada: fmtDate(b.data) })),
    ),
  );

  const blob = new Blob([sections.join("\n")], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `relatorio_${p.display_name ?? p.id}.csv`);
}

// ------- PDF: paleta -------

const C = {
  sage: [184, 201, 176] as [number, number, number],
  sageDark: [120, 142, 110] as [number, number, number],
  blush: [233, 198, 175] as [number, number, number],
  lilac: [200, 187, 222] as [number, number, number],
  sky: [173, 200, 222] as [number, number, number],
  ink: [40, 40, 40] as [number, number, number],
  muted: [120, 120, 120] as [number, number, number],
  line: [222, 217, 205] as [number, number, number],
  bg: [250, 247, 240] as [number, number, number],
  good: [110, 165, 120] as [number, number, number],
  warn: [220, 150, 60] as [number, number, number],
  bad: [200, 90, 90] as [number, number, number],
};

// ------- Helpers de desenho -------

function header(doc: jsPDF, title: string, subtitle?: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...C.ink);
  doc.text("Lei.co", 40, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...C.muted);
  doc.text("Relatório administrativo do aluno", 40, 56);
  doc.setDrawColor(...C.line);
  doc.line(40, 66, w - 40, 66);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.ink);
  doc.text(title, 40, 88);
  if (subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text(subtitle, 40, 102);
  }
}

function footer(doc: jsPDF, pageNum: number, total: number) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, h - 24);
  doc.text(`Página ${pageNum} de ${total}`, w - 40, h - 24, { align: "right" });
}

function colorByPct(pct: number): [number, number, number] {
  if (pct >= 75) return C.good;
  if (pct >= 40) return C.warn;
  return C.bad;
}

// Bar chart vertical
function drawBarChart(
  doc: jsPDF,
  opts: {
    x: number; y: number; w: number; h: number;
    labels: string[]; values: number[];
    unit?: string; color?: [number, number, number];
  },
) {
  const { x, y, w, h, labels, values, unit = "", color = C.sageDark } = opts;
  const max = Math.max(1, ...values);
  const padLeft = 28, padBottom = 22, padTop = 14;
  const innerW = w - padLeft;
  const innerH = h - padBottom - padTop;
  const n = values.length || 1;
  const slot = innerW / n;
  const barW = Math.min(slot * 0.6, 32);

  // Eixo
  doc.setDrawColor(...C.line);
  doc.line(x + padLeft, y + padTop, x + padLeft, y + padTop + innerH);
  doc.line(x + padLeft, y + padTop + innerH, x + w, y + padTop + innerH);

  // Gridlines
  doc.setDrawColor(240, 235, 222);
  for (let i = 1; i <= 3; i++) {
    const gy = y + padTop + (innerH * i) / 4;
    doc.line(x + padLeft, gy, x + w, gy);
  }
  // Y labels (max e meio)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(String(Math.round(max)), x + padLeft - 4, y + padTop + 4, { align: "right" });
  doc.text(String(Math.round(max / 2)), x + padLeft - 4, y + padTop + innerH / 2 + 2, { align: "right" });

  // Barras
  values.forEach((v, i) => {
    const bx = x + padLeft + slot * i + (slot - barW) / 2;
    const bh = max > 0 ? (v / max) * innerH : 0;
    const by = y + padTop + innerH - bh;
    doc.setFillColor(...(v > 0 ? color : C.line));
    doc.roundedRect(bx, by, barW, bh, 2, 2, "F");
    // valor topo
    if (v > 0) {
      doc.setFontSize(7);
      doc.setTextColor(...C.ink);
      doc.text(`${v}${unit}`, bx + barW / 2, by - 3, { align: "center" });
    }
    // label x
    doc.setFontSize(7);
    doc.setTextColor(...C.muted);
    doc.text(labels[i] ?? "", bx + barW / 2, y + padTop + innerH + 12, { align: "center" });
  });
}

// Bar chart horizontal (top materias)
function drawHBarChart(
  doc: jsPDF,
  opts: {
    x: number; y: number; w: number; h: number;
    items: { label: string; value: number; pct?: number }[];
    unit?: string; color?: [number, number, number];
  },
) {
  const { x, y, w, h, items, unit = "", color = C.sageDark } = opts;
  if (items.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...C.muted);
    doc.text("Sem dados", x, y + 14);
    return;
  }
  const max = Math.max(1, ...items.map((i) => i.value));
  const rowH = Math.min(20, h / items.length);
  const labelW = 110;
  const barX = x + labelW;
  const barMaxW = w - labelW - 50;

  items.forEach((it, i) => {
    const ry = y + i * rowH + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.ink);
    const label = it.label.length > 22 ? it.label.slice(0, 21) + "…" : it.label;
    doc.text(label, x, ry + 8);
    const bw = (it.value / max) * barMaxW;
    doc.setFillColor(...C.line);
    doc.roundedRect(barX, ry, barMaxW, 8, 2, 2, "F");
    doc.setFillColor(...color);
    doc.roundedRect(barX, ry, Math.max(1, bw), 8, 2, 2, "F");
    doc.setFontSize(8);
    doc.setTextColor(...C.ink);
    doc.text(`${it.value}${unit}`, barX + barMaxW + 6, ry + 7);
  });
}

// Progress card por matéria
function drawMateriaCard(
  doc: jsPDF,
  m: { cronograma: string; nome: string; concluidos: number; total: number; pct: number },
  x: number,
  y: number,
  w: number,
) {
  const h = 48;
  doc.setDrawColor(...C.line);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, w, h, 4, 4, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...C.ink);
  const nome = m.nome.length > 38 ? m.nome.slice(0, 37) + "…" : m.nome;
  doc.text(nome, x + 10, y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  const cron = m.cronograma.length > 42 ? m.cronograma.slice(0, 41) + "…" : m.cronograma;
  doc.text(cron, x + 10, y + 28);

  // barra
  const barY = y + 34;
  const barX = x + 10;
  const barW = w - 70;
  doc.setFillColor(...C.line);
  doc.roundedRect(barX, barY, barW, 6, 2, 2, "F");
  const col = colorByPct(m.pct);
  doc.setFillColor(...col);
  doc.roundedRect(barX, barY, Math.max(1, (m.pct / 100) * barW), 6, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...col);
  doc.text(`${m.pct}%`, x + w - 10, y + 38, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(`${m.concluidos}/${m.total} tópicos`, x + w - 10, y + 24, { align: "right" });
}

// Donut simples (aproximado em segmentos)
function drawDonut(
  doc: jsPDF,
  cx: number, cy: number, r: number,
  pct: number, color: [number, number, number],
  centerText: string,
) {
  // anel base
  doc.setDrawColor(...C.line);
  doc.setLineWidth(8);
  doc.circle(cx, cy, r, "S");
  // arco preenchido aproximado por linhas
  const steps = Math.max(2, Math.round(60 * (pct / 100)));
  if (pct > 0) {
    doc.setDrawColor(...color);
    doc.setLineWidth(8);
    const start = -Math.PI / 2;
    const end = start + (Math.PI * 2 * pct) / 100;
    let prevX = cx + r * Math.cos(start);
    let prevY = cy + r * Math.sin(start);
    for (let i = 1; i <= steps; i++) {
      const a = start + ((end - start) * i) / steps;
      const nx = cx + r * Math.cos(a);
      const ny = cy + r * Math.sin(a);
      doc.line(prevX, prevY, nx, ny);
      prevX = nx; prevY = ny;
    }
  }
  doc.setLineWidth(0.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C.ink);
  doc.text(centerText, cx, cy + 4, { align: "center" });
}

// ------- PDF principal -------

export function downloadPDF(report: AdminUserReport) {
  const p = report.profile;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();

  // ===== Página 1: capa + métricas =====
  header(doc, "Visão geral", `${p.display_name ?? "Sem nome"} • ${p.email ?? "—"}`);

  // Cartão identidade
  doc.setFillColor(...C.bg);
  doc.roundedRect(40, 118, pw - 80, 76, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...C.ink);
  doc.text(p.display_name ?? "Sem nome", 56, 142);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...C.muted);
  doc.text(`Plano: ${p.plano_atual}  •  Membro desde ${fmtDate(p.created_at)}`, 56, 158);
  doc.text(`Telefone: ${p.telefone ?? "—"}  •  Friend ID: ${p.friend_id ?? "—"}`, 56, 172);
  doc.text(`Última atividade: ${fmtDate(p.last_seen)}  •  ${p.bloqueado ? "BLOQUEADO" : "Ativo"}`, 56, 186);

  // Donuts de KPI
  const donutY = 250;
  drawDonut(doc, 100, donutY, 38, Math.min(100, p.metrics.acertosMedio), C.sageDark, `${p.metrics.acertosMedio}%`);
  doc.setFontSize(9); doc.setTextColor(...C.muted);
  doc.text("Acerto médio", 100, donutY + 58, { align: "center" });

  const streakPct = Math.min(100, p.metrics.streak * 5);
  drawDonut(doc, 230, donutY, 38, streakPct, [200, 110, 90], `${p.metrics.streak}d`);
  doc.text("Streak", 230, donutY + 58, { align: "center" });

  const horasPct = Math.min(100, p.metrics.horasEstudadas);
  drawDonut(doc, 360, donutY, 38, horasPct, [110, 140, 200], `${p.metrics.horasEstudadas}h`);
  doc.text("Horas totais", 360, donutY + 58, { align: "center" });

  const qPct = Math.min(100, p.metrics.questoesFeitas / 10);
  drawDonut(doc, 490, donutY, 38, qPct, [180, 140, 200], `${p.metrics.questoesFeitas}`);
  doc.text("Questões", 490, donutY + 58, { align: "center" });

  // Resumo
  const finalizadas = report.materias.filter((m) => m.total > 0 && m.pct >= 100).length;
  const emAndamento = report.materias.filter((m) => m.pct > 0 && m.pct < 100).length;
  const naoIniciadas = report.materias.filter((m) => m.pct === 0).length;

  autoTable(doc, {
    startY: 340,
    head: [["Indicador", "Valor"]],
    body: [
      ["Cronogramas ativos", String(report.cronogramas.length)],
      ["Matérias finalizadas (100%)", String(finalizadas)],
      ["Matérias em andamento", String(emAndamento)],
      ["Matérias não iniciadas", String(naoIniciadas)],
      ["Badges conquistadas", String(p.metrics.badges)],
      ["Total de sessões registradas", String(report.sessoes.length)],
    ],
    theme: "grid",
    headStyles: { fillColor: C.sage, textColor: C.ink },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });

  // ===== Página 2: Desempenho =====
  doc.addPage();
  header(doc, "Desempenho dos últimos 14 dias");

  // Agrega sessões por dia
  const days: string[] = [];
  const dayLabels: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
    dayLabels.push(`${d.getDate()}/${d.getMonth() + 1}`);
  }
  const horasPorDia = days.map((d) => {
    const min = report.sessoes
      .filter((s) => s.data === d)
      .reduce((acc, s) => acc + parseTempoMin(s.tempo), 0);
    return parseFloat((min / 60).toFixed(1));
  });
  const qPorDia = days.map((d) =>
    report.sessoes.filter((s) => s.data === d).reduce((acc, s) => acc + s.questoes, 0),
  );

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C.ink);
  doc.text("Horas estudadas por dia", 40, 128);
  drawBarChart(doc, {
    x: 40, y: 134, w: pw - 80, h: 160,
    labels: dayLabels, values: horasPorDia, unit: "h", color: C.sageDark,
  });

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C.ink);
  doc.text("Questões resolvidas por dia", 40, 320);
  drawBarChart(doc, {
    x: 40, y: 326, w: pw - 80, h: 160,
    labels: dayLabels, values: qPorDia, color: [180, 140, 200],
  });

  // Totais 14d
  const totalMin14 = days.reduce(
    (acc, d) => acc + report.sessoes.filter((s) => s.data === d).reduce((a, s) => a + parseTempoMin(s.tempo), 0),
    0,
  );
  const totalQ14 = qPorDia.reduce((a, b) => a + b, 0);
  const totalA14 = days.reduce(
    (acc, d) => acc + report.sessoes.filter((s) => s.data === d).reduce((a, s) => a + s.acertos, 0),
    0,
  );
  const pct14 = totalQ14 > 0 ? Math.round((totalA14 / totalQ14) * 100) : 0;

  autoTable(doc, {
    startY: 510,
    head: [["Janela 14d", "Horas", "Questões", "Acertos", "% Acerto"]],
    body: [[
      `${days[0]} → ${days[days.length - 1]}`,
      minToHumanH(totalMin14),
      String(totalQ14),
      String(totalA14),
      `${pct14}%`,
    ]],
    theme: "grid",
    headStyles: { fillColor: C.blush, textColor: C.ink },
    styles: { fontSize: 10 },
    margin: { left: 40, right: 40 },
  });

  // ===== Página 3: Cronogramas =====
  doc.addPage();
  header(doc, "Progresso por cronograma");

  if (report.cronogramas.length === 0) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...C.muted);
    doc.text("Nenhum cronograma ativo.", 40, 130);
  } else {
    autoTable(doc, {
      startY: 120,
      head: [["Cronograma", "Concluídos", "Total", "%"]],
      body: report.cronogramas.map((c) => [c.nome, c.concluidos, c.total_topicos, `${c.pct}%`]),
      theme: "grid",
      headStyles: { fillColor: C.lilac, textColor: C.ink },
      styles: { fontSize: 10 },
      margin: { left: 40, right: 40 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const pct = parseInt(String(data.cell.raw).replace("%", ""), 10) || 0;
          data.cell.styles.textColor = colorByPct(pct);
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  // Top matérias por progresso
  const topProg = [...report.materias].filter((m) => m.total > 0).slice(0, 10);
  const startY = (doc as any).lastAutoTable?.finalY ?? 140;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C.ink);
  doc.text("Top matérias por conclusão", 40, startY + 28);
  drawHBarChart(doc, {
    x: 40, y: startY + 36, w: pw - 80, h: 200,
    items: topProg.map((m) => ({ label: m.nome, value: m.pct })),
    unit: "%", color: C.sageDark,
  });

  // ===== Página 4: Matérias finalizadas =====
  doc.addPage();
  header(doc, "Matérias finalizadas", `${finalizadas} matéria(s) com 100% de conclusão`);
  const finList = report.materias.filter((m) => m.total > 0 && m.pct >= 100);
  if (finList.length === 0) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...C.muted);
    doc.text("Nenhuma matéria finalizada ainda.", 40, 130);
  } else {
    let yy = 120;
    const colW = (pw - 80 - 12) / 2;
    finList.forEach((m, i) => {
      const col = i % 2;
      const x = 40 + col * (colW + 12);
      if (col === 0 && i > 0) yy += 54;
      if (yy > 760) { doc.addPage(); header(doc, "Matérias finalizadas (cont.)"); yy = 120; }
      drawMateriaCard(doc, m, x, yy, colW);
    });
  }

  // ===== Página 5: Matérias restantes =====
  doc.addPage();
  header(doc, "Matérias restantes do cronograma", `${emAndamento + naoIniciadas} matéria(s) ainda em progresso`);
  const restList = report.materias.filter((m) => m.total > 0 && m.pct < 100);
  if (restList.length === 0) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(...C.muted);
    doc.text("Todas as matérias foram concluídas.", 40, 130);
  } else {
    let yy = 120;
    const colW = (pw - 80 - 12) / 2;
    restList.forEach((m, i) => {
      const col = i % 2;
      const x = 40 + col * (colW + 12);
      if (col === 0 && i > 0) yy += 54;
      if (yy > 760) { doc.addPage(); header(doc, "Matérias restantes (cont.)"); yy = 120; }
      drawMateriaCard(doc, m, x, yy, colW);
    });
  }

  // ===== Página 6: Ranking por horas e acertos por matéria =====
  doc.addPage();
  header(doc, "Ranking por matéria");

  const porMateria = new Map<string, { min: number; q: number; ac: number }>();
  for (const s of report.sessoes) {
    const cur = porMateria.get(s.materia) ?? { min: 0, q: 0, ac: 0 };
    cur.min += parseTempoMin(s.tempo);
    cur.q += s.questoes;
    cur.ac += s.acertos;
    porMateria.set(s.materia, cur);
  }
  const arr = [...porMateria.entries()].map(([nome, v]) => ({
    nome,
    horas: parseFloat((v.min / 60).toFixed(1)),
    questoes: v.q,
    pct: v.q > 0 ? Math.round((v.ac / v.q) * 100) : 0,
  }));

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C.ink);
  doc.text("Horas estudadas por matéria", 40, 128);
  drawHBarChart(doc, {
    x: 40, y: 136, w: pw - 80, h: 160,
    items: arr.sort((a, b) => b.horas - a.horas).slice(0, 8).map((m) => ({ label: m.nome, value: m.horas })),
    unit: "h", color: C.sageDark,
  });

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C.ink);
  doc.text("Questões resolvidas por matéria", 40, 320);
  drawHBarChart(doc, {
    x: 40, y: 328, w: pw - 80, h: 160,
    items: arr.sort((a, b) => b.questoes - a.questoes).slice(0, 8).map((m) => ({ label: m.nome, value: m.questoes })),
    color: [180, 140, 200],
  });

  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...C.ink);
  doc.text("% de acerto por matéria (mín. 10 questões)", 40, 510);
  drawHBarChart(doc, {
    x: 40, y: 518, w: pw - 80, h: 160,
    items: arr.filter((m) => m.questoes >= 10).sort((a, b) => b.pct - a.pct).slice(0, 8).map((m) => ({ label: m.nome, value: m.pct })),
    unit: "%", color: [110, 165, 120],
  });

  // ===== Histórico de sessões =====
  doc.addPage();
  header(doc, "Histórico de sessões", `Últimas ${Math.min(report.sessoes.length, 100)} sessões`);
  autoTable(doc, {
    startY: 120,
    head: [["Data", "Matéria", "Tópico", "Tempo", "Q", "✓", "%"]],
    body: report.sessoes.slice(0, 100).map((s) => [
      fmtDate(s.data),
      s.materia,
      s.topico,
      s.tempo,
      s.questoes,
      s.acertos,
      `${s.pct}%`,
    ]),
    theme: "striped",
    headStyles: { fillColor: C.lilac, textColor: C.ink },
    styles: { fontSize: 8 },
    margin: { left: 40, right: 40 },
  });

  // ===== Badges =====
  if (report.badges.length > 0) {
    doc.addPage();
    header(doc, "Badges conquistadas", `${report.badges.length} medalha(s)`);
    autoTable(doc, {
      startY: 120,
      head: [["Badge", "Desbloqueada em"]],
      body: report.badges.map((b) => [b.nome, fmtDate(b.data)]),
      theme: "grid",
      headStyles: { fillColor: C.sage, textColor: C.ink },
      styles: { fontSize: 10 },
      margin: { left: 40, right: 40 },
    });
  }

  // Footer em todas as páginas
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    footer(doc, i, totalPages);
  }

  doc.save(`relatorio_${p.display_name ?? p.id}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
