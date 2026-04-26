import { useEffect, useMemo, useState } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  addMonths,
  differenceInCalendarDays,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ExternalLink, Info, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { colorForMateria, getCorMateriaPastel } from "@/lib/materia-color";
import type { Fonte } from "./NovoTopicoForm";
import { CronometroBloco } from "./CronometroBloco";
import { RegistrarSessaoModal } from "./RegistrarSessaoModal";
import { LimparEventosModal } from "./LimparEventosModal";
import { useIsMobile } from "@/hooks/use-mobile";

export type CalendarioEvento = {
  id: string;
  titulo: string;
  data: string;
  cor: string | null;
  concluido: boolean;
  topico_id: string | null;
  materia_id: string | null;
  is_revisao: boolean;
};

type Topico = {
  id: string;
  titulo: string;
  materia_id: string;
  materia_nome: string;
  horas_estimadas: number;
  fontes?: Fonte[];
};

type Props = {
  eventos: CalendarioEvento[];
  topicos: Topico[];
  userId: string;
  cronogramaId: string;
  materias: { id: string; nome: string }[];
  onChange: () => void;
};

function isoDate(d: Date) {
  return format(d, "yyyy-MM-dd");
}

function nextWeekday(d: Date): Date {
  const r = new Date(d);
  while (r.getDay() === 0) r.setDate(r.getDate() + 1);
  return r;
}

export function CalendarioTab({
  eventos,
  topicos,
  userId,
  cronogramaId,
  materias,
  onChange,
}: Props) {
  const isMobile = useIsMobile();
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [horasDia, setHorasDia] = useState("3");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [sessaoOpen, setSessaoOpen] = useState(false);
  const [sessaoSegundos, setSessaoSegundos] = useState(0);
  const [limparOpen, setLimparOpen] = useState(false);
  const [detailDay, setDetailDay] = useState<string | null>(null);

  const materiaNome = useMemo(() => {
    const m = new Map<string, string>();
    materias.forEach((x) => m.set(x.id, x.nome));
    return m;
  }, [materias]);

  const topicoById = useMemo(() => {
    const m = new Map<string, Topico>();
    topicos.forEach((t) => m.set(t.id, t));
    return m;
  }, [topicos]);

  // Add materia_nome derivative to events
  const evs = useMemo(
    () =>
      eventos.map((e) => ({
        ...e,
        materia_nome: e.materia_id ? materiaNome.get(e.materia_id) ?? "—" : "—",
      })),
    [eventos, materiaNome],
  );

  const today = new Date();
  const todayKey = isoDate(today);
  const eventosHoje = evs.filter((e) => e.data === todayKey);

  const dias = useMemo(() => {
    const monthStart = startOfMonth(refDate);
    const monthEnd = endOfMonth(refDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const out: Date[] = [];
    let cur = gridStart;
    while (cur <= gridEnd) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }, [refDate]);

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, typeof evs>();
    for (const e of evs) {
      const arr = map.get(e.data) ?? [];
      arr.push(e);
      map.set(e.data, arr);
    }
    return map;
  }, [evs]);

  // Materias presentes no mês visível para legenda
  const materiasNoMes = useMemo(() => {
    const set = new Map<string, string>();
    for (const e of evs) {
      const d = parseISO(e.data);
      if (isSameMonth(d, refDate) && e.materia_id) {
        set.set(e.materia_id, e.materia_nome);
      }
    }
    return Array.from(set.entries()).map(([id, nome]) => ({ id, nome }));
  }, [evs, refDate]);

  // Flags de legenda condicionais ao mês visível
  const { temRevisaoNoMes, temAtraso1d, temAtraso4d } = useMemo(() => {
    let rev = false;
    let a1 = false;
    let a4 = false;
    for (const e of evs) {
      const d = parseISO(e.data);
      if (!isSameMonth(d, refDate)) continue;
      if (e.concluido) continue;
      if (e.is_revisao) rev = true;
      const diff = differenceInCalendarDays(today, d);
      if (diff >= 4) a4 = true;
      else if (diff >= 1) a1 = true;
    }
    return { temRevisaoNoMes: rev, temAtraso1d: a1, temAtraso4d: a4 };
  }, [evs, refDate, today]);

  function statusCelula(d: Date, list: typeof evs): {
    bg: string;
    border: string;
  } {
    const todayD = today;
    const pendentes = list.filter((e) => !e.concluido);
    if (pendentes.length === 0) return { bg: "#ffffff", border: "#e5e7eb" };
    const temRevisao = pendentes.some((e) => e.is_revisao);
    const diff = differenceInCalendarDays(todayD, d);
    if (diff >= 4) return { bg: "#FFF0F0", border: "#E24B4A" };
    if (diff >= 1) return { bg: "#FFFBEA", border: "#EF9F27" };
    if (temRevisao) return { bg: "#EFF6FF", border: "#378ADD" };
    return { bg: "#ffffff", border: "#e5e7eb" };
  }

  async function moveEvento(id: string, novaData: string) {
    const ev = evs.find((e) => e.id === id);
    if (!ev || ev.data === novaData || ev.concluido) return;
    const { error } = await supabase
      .from("user_calendar_events")
      .update({ data: novaData })
      .eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  }

  async function shiftEventos(deltaDias: number) {
    const pendentes = evs.filter((e) => !e.concluido);
    if (pendentes.length === 0) return;
    for (const ev of pendentes) {
      const nova = addDays(parseISO(ev.data), deltaDias);
      // pular domingos
      const adj = nextWeekday(nova);
      await supabase
        .from("user_calendar_events")
        .update({ data: isoDate(adj) })
        .eq("id", ev.id);
    }
    toast.success(`Eventos movidos ${deltaDias > 0 ? "+" : ""}${deltaDias} dias`);
    onChange();
  }

  async function distribuir() {
    const h = parseInt(horasDia, 10);
    if (!h || h <= 0) return toast.error("Informe horas/dia válidas");

    // Buscar tópicos pendentes (sem evento concluido)
    const concluidos = new Set(evs.filter((e) => e.concluido).map((e) => e.topico_id));
    const pendentes = topicos.filter((t) => !concluidos.has(t.id));
    if (pendentes.length === 0) return toast.error("Nenhum tópico pendente");

    // Apagar eventos não concluídos atuais
    await supabase
      .from("user_calendar_events")
      .delete()
      .eq("user_id", userId)
      .eq("cronograma_id", cronogramaId)
      .eq("concluido", false);

    // Distribuir respeitando h/dia, pulando domingos, proporcional a horas_estimadas
    let cursor = nextWeekday(new Date());
    let horasNoDia = 0;
    const inserts: Array<{
      user_id: string;
      cronograma_id: string;
      materia_id: string | null;
      topico_id: string;
      titulo: string;
      data: string;
      cor: string;
      concluido: boolean;
      is_revisao: boolean;
    }> = [];

    for (const t of pendentes) {
      if (horasNoDia + t.horas_estimadas > h && horasNoDia > 0) {
        cursor = nextWeekday(addDays(cursor, 1));
        horasNoDia = 0;
      }
      inserts.push({
        user_id: userId,
        cronograma_id: cronogramaId,
        materia_id: t.materia_id,
        topico_id: t.id,
        titulo: t.titulo,
        data: isoDate(cursor),
        cor: colorForMateria(t.materia_nome),
        concluido: false,
        is_revisao: false,
      });
      horasNoDia += t.horas_estimadas;
      if (horasNoDia >= h) {
        cursor = nextWeekday(addDays(cursor, 1));
        horasNoDia = 0;
      }
    }

    for (let i = 0; i < inserts.length; i += 500) {
      const batch = inserts.slice(i, i + 500);
      const { error } = await supabase.from("user_calendar_events").insert(batch);
      if (error) return toast.error(error.message);
    }
    toast.success("Tópicos distribuídos");
    onChange();
  }

  function onCronStop(seg: number) {
    setSessaoSegundos(seg);
    setSessaoOpen(true);
  }

  if (eventos.length === 0 && topicos.length === 0) {
    return (
      <div className="lei-card text-center py-12 text-text-muted text-[13px]">
        Ative o cronograma para ver seus tópicos distribuídos por dia.
      </div>
    );
  }

  const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const headerLabel = format(refDate, "MMMM 'de' yyyy", { locale: ptBR });

  const detailEvs = detailDay ? eventosPorDia.get(detailDay) ?? [] : [];

  return (
    <div>
      <CronometroBloco hoje={today} eventosHoje={eventosHoje} onStop={onCronStop} />

      {/* Controles */}
      <div className="lei-card mb-3 !p-3 md:!p-3" style={isMobile ? { padding: 10 } : undefined}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Navegação do mês */}
          <div className="flex items-center gap-2 max-md:w-full max-md:justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefDate((d) => addMonths(d, -1))}
              className="h-8 w-8 p-0 rounded-[8px]"
              aria-label="Mês anterior"
            >
              <ChevronLeft size={14} />
            </Button>
            <div className="text-[13px] capitalize font-medium" style={{ color: "#111827" }}>
              {headerLabel}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefDate((d) => addMonths(d, 1))}
              className="h-8 w-8 p-0 rounded-[8px]"
              aria-label="Próximo mês"
            >
              <ChevronRight size={14} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefDate(new Date())}
              className="h-8 px-3 rounded-[8px] text-[12px]"
            >
              Hoje
            </Button>
          </div>

          {/* Botões de deslocamento */}
          <div className="flex items-center gap-1 flex-wrap max-md:w-full">
            <Button variant="outline" size="sm" onClick={() => shiftEventos(-7)} className="h-8 rounded-[8px] text-[12px] max-md:flex-1 max-md:px-1">−7d</Button>
            <Button variant="outline" size="sm" onClick={() => shiftEventos(-1)} className="h-8 rounded-[8px] text-[12px] max-md:flex-1 max-md:px-1">−1d</Button>
            <Button variant="outline" size="sm" onClick={() => shiftEventos(1)} className="h-8 rounded-[8px] text-[12px] max-md:flex-1 max-md:px-1">+1d</Button>
            <Button variant="outline" size="sm" onClick={() => shiftEventos(7)} className="h-8 rounded-[8px] text-[12px] max-md:flex-1 max-md:px-1">+7d</Button>
          </div>

          {/* Ações: h/dia + Calcular + Limpar */}
          <div className="flex items-center gap-2 max-md:w-full">
            <Input
              value={horasDia}
              onChange={(e) => setHorasDia(e.target.value)}
              type="number"
              min={1}
              className="h-8 w-[70px] max-md:w-[52px] text-[12px]"
              placeholder="h/dia"
            />
            <Button
              size="sm"
              onClick={distribuir}
              className="h-8 rounded-[8px] text-[12px] bg-sage-dark hover:bg-sage-dark/90 text-white max-md:flex-1"
            >
              Calcular
            </Button>
            <button
              onClick={() => setLimparOpen(true)}
              className="inline-flex items-center gap-1 h-8 px-3 rounded-[8px] text-[12px] transition-colors hover:bg-[#FFF0F0] flex-shrink-0"
              style={{ border: "1px solid #E24B4A", color: "#E24B4A", background: "transparent" }}
            >
              <Trash2 size={12} /> Limpar
            </button>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-2 max-md:gap-1 mb-4 max-md:mb-2">
        {materiasNoMes.map((m) => {
          const p = getCorMateriaPastel(m.nome);
          return (
            <span
              key={m.id}
              className="text-[11px] max-md:text-[10px] px-2 max-md:px-[6px] py-[2px] rounded-[99px] font-medium"
              style={{ background: p.background, color: p.color }}
            >
              {m.nome}
            </span>
          );
        })}
        {temRevisaoNoMes && (
          <span className="text-[11px] max-md:text-[10px] px-2 max-md:px-[6px] py-[2px] rounded-[99px] text-white" style={{ background: "#6B7280" }}>
            Revisão
          </span>
        )}
        {temAtraso1d && (
          <span className="text-[11px] max-md:text-[10px] px-2 max-md:px-[6px] py-[2px] rounded-[99px]" style={{ background: "#FFFBEA", color: "#B86E07", border: "1px solid #EF9F27" }}>
            Atrasado +1d
          </span>
        )}
        {temAtraso4d && (
          <span className="text-[11px] max-md:text-[10px] px-2 max-md:px-[6px] py-[2px] rounded-[99px]" style={{ background: "#FFF0F0", color: "#E24B4A", border: "1px solid #E24B4A" }}>
            Atrasado +4d
          </span>
        )}
      </div>

      {/* Wrapper com scroll horizontal em telas <1024px */}
      <div
        className="lg:overflow-visible overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="lg:min-w-0 min-w-[700px]">
          {/* Cabeçalho de dias da semana */}
          <div className="grid grid-cols-7 gap-2 mb-1">
            {weekdays.map((w, i) => (
              <div key={`${w}-${i}`} className="text-[10px] uppercase tracking-wider text-text-muted text-center">
                {w}
              </div>
            ))}
          </div>

      {/* Grade */}
      <div className="grid grid-cols-7 gap-2">
        {dias.map((d) => {
          const key = isoDate(d);
          const list = eventosPorDia.get(key) ?? [];
          const isToday = isSameDay(d, today);
          const isOver = dragOverDay === key;
          const outOfMonth = !isSameMonth(d, refDate);
          const status = statusCelula(d, list);
          const visiveis = list.slice(0, 3);
          const overflow = list.length - visiveis.length;

          return (
            <div
              key={key}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverDay !== key) setDragOverDay(key);
              }}
              onDragLeave={() => {
                if (dragOverDay === key) setDragOverDay(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                setDragOverDay(null);
                setDraggingId(null);
                if (id) moveEvento(id, key);
              }}
              className={`relative rounded-[10px] p-2 min-h-[110px] transition-colors ${
                outOfMonth ? "opacity-50" : ""
              }`}
              style={{
                background: isOver ? "#EFF6FF" : status.bg,
                border: `1px solid ${isOver ? "#378ADD" : status.border}`,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                {isToday ? (
                  <div
                    className="flex items-center justify-center"
                    style={{
                      background: "#1D9E75",
                      color: "white",
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      fontWeight: 600,
                      fontSize: 12,
                    }}
                  >
                    {format(d, "dd")}
                  </div>
                ) : (
                  <div className="text-[13px] font-medium" style={{ color: "#374151" }}>
                    {format(d, "dd")}
                  </div>
                )}
                {list.length > 0 && (
                  <button
                    onClick={() => setDetailDay(key)}
                    className="text-[#9ca3af] hover:text-[#374151]"
                    aria-label="Detalhes"
                  >
                    <Info size={12} />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-1">
                {visiveis.map((ev) => {
                  const pastel = getCorMateriaPastel(ev.materia_nome);
                  const bg = ev.concluido
                    ? "#e5e7eb"
                    : ev.is_revisao
                      ? "#F1EFE8"
                      : pastel.background;
                  const fg = ev.concluido
                    ? "#9ca3af"
                    : ev.is_revisao
                      ? "#444441"
                      : pastel.color;
                  return (
                    <div
                      key={ev.id}
                      draggable={!ev.concluido}
                      onDragStart={(e) => {
                        if (ev.concluido) return;
                        e.dataTransfer.setData("text/plain", ev.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingId(ev.id);
                      }}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setDragOverDay(null);
                      }}
                      onClick={() => {
                        if (isMobile) setDetailDay(key);
                      }}
                      className={`text-[11px] max-md:text-[9px] px-2 max-md:px-[4px] py-[2px] max-md:py-[1px] rounded-[99px] truncate font-medium ${
                        ev.concluido ? "line-through cursor-default" : "cursor-grab active:cursor-grabbing"
                      } ${draggingId === ev.id ? "opacity-50" : ""}`}
                      style={{ background: bg, color: fg }}
                      title={ev.titulo}
                    >
                      {ev.is_revisao && !ev.concluido ? `Rev: ${ev.titulo}` : ev.titulo}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <button
                    onClick={() => setDetailDay(key)}
                    className="text-[10px] text-text-muted text-left hover:text-text-main"
                  >
                    +{overflow} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal detalhes do dia */}
      <Dialog open={detailDay !== null} onOpenChange={(v) => !v && setDetailDay(null)}>
        <DialogContent
          className="sm:max-w-[420px] rounded-[12px] p-6 gap-0"
          style={{ background: "#ffffff" }}
        >
          <DialogTitle
            className="font-medium mb-4"
            style={{ fontSize: "15px", color: "#111827", fontFamily: "inherit" }}
          >
            {detailDay
              ? format(parseISO(detailDay), "EEEE',' dd 'de' MMMM", { locale: ptBR })
              : ""}
          </DialogTitle>
          <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto">
            {detailEvs.map((ev) => {
              const pastel = getCorMateriaPastel(ev.materia_nome);
              const dias = detailDay
                ? differenceInCalendarDays(today, parseISO(detailDay))
                : 0;
              let statusLabel: { txt: string; color: string };
              if (ev.concluido) statusLabel = { txt: "✓ Concluído", color: "#1D9E75" };
              else if (dias >= 4) statusLabel = { txt: `Atrasado ${dias} dias`, color: "#E24B4A" };
              else if (dias >= 1) statusLabel = { txt: `Atrasado ${dias} dias`, color: "#EF9F27" };
              else statusLabel = { txt: "Pendente", color: "#6b7280" };

              const topico = ev.topico_id ? topicoById.get(ev.topico_id) : undefined;
              const fontes = topico?.fontes ?? [];
              const hasQuestoes = (f: Fonte) =>
                !!(f.link_questoes ||
                  (f.links_questoes && f.links_questoes.some((l) => !!l)));
              const semQ = fontes.filter((f) => !hasQuestoes(f));
              const comQ = fontes.filter((f) => hasQuestoes(f));

              const linksQAll = fontes.flatMap((f) => {
                const arr = f.links_questoes && f.links_questoes.length > 0
                  ? f.links_questoes
                  : f.link_questoes ? [f.link_questoes] : [];
                return arr.filter(Boolean).map((url) => ({ sigla: f.sigla, url }));
              });
              const linksDAll = fontes.flatMap((f) => {
                const arr = f.links_dod && f.links_dod.length > 0
                  ? f.links_dod
                  : f.link_dod ? [f.link_dod] : [];
                return arr.filter(Boolean).map((url) => ({ sigla: f.sigla, url }));
              });

              const renderFonteRow = (f: Fonte, idx: number) => (
                <div key={`${f.sigla}-${idx}`} className="flex items-start gap-2 py-[2px]">
                  <Checkbox checked={false} disabled className="mt-[2px] h-3 w-3" />
                  <span style={{ fontWeight: 600, fontSize: 11, minWidth: 36, color: "#374151" }}>
                    {f.sigla}
                  </span>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{f.descricao}</span>
                </div>
              );

              return (
                <div
                  key={ev.id}
                  className="rounded-[10px] p-3"
                  style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
                >
                  <span
                    className="inline-block text-[11px] px-2 py-[2px] rounded-[99px] mb-2 font-medium"
                    style={
                      ev.is_revisao
                        ? { background: "#F1EFE8", color: "#444441" }
                        : { background: pastel.background, color: pastel.color }
                    }
                  >
                    {ev.is_revisao ? `Rev — ${ev.materia_nome}` : ev.materia_nome}
                  </span>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>
                    {topico?.titulo ?? ev.titulo}
                  </div>
                  {topico && (
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                      {topico.horas_estimadas}h estimadas
                    </div>
                  )}

                  {fontes.length > 0 && (
                    <div className="mt-2">
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                        Fonte legal
                      </div>
                      {semQ.map((f, i) => renderFonteRow(f, i))}
                      {comQ.length > 0 && (
                        <>
                          {semQ.length > 0 && (
                            <div style={{ borderTop: "1px solid #e5e7eb", margin: "6px 0" }} />
                          )}
                          <div style={{ background: "#F7F4EE", borderRadius: 6, padding: "5px 7px", marginTop: 2 }}>
                            {comQ.map((f, i) => renderFonteRow(f, i))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {(linksQAll.length > 0 || linksDAll.length > 0) && (
                    <div className="mt-2 flex flex-col gap-1">
                      {linksQAll.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center">
                          <span style={{ fontSize: 10, color: "#6b7280", marginRight: 2 }}>Questões:</span>
                          {linksQAll.map((l, i) => (
                            <a
                              key={`q-${i}`}
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1"
                              style={{
                                fontSize: 10,
                                color: "#378ADD",
                                border: "1px solid #B5D4F4",
                                borderRadius: 20,
                                padding: "1px 7px",
                              }}
                            >
                              {l.sigla} <ExternalLink size={9} />
                            </a>
                          ))}
                        </div>
                      )}
                      {linksDAll.length > 0 && (
                        <div className="flex flex-wrap gap-1 items-center">
                          <span style={{ fontSize: 10, color: "#6b7280", marginRight: 2 }}>DOD:</span>
                          {linksDAll.map((l, i) => (
                            <a
                              key={`d-${i}`}
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1"
                              style={{
                                fontSize: 10,
                                color: "#378ADD",
                                border: "1px solid #B5D4F4",
                                borderRadius: 20,
                                padding: "1px 7px",
                              }}
                            >
                              {l.sigla} <ExternalLink size={9} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div
                    className="mt-2"
                    style={{ fontSize: 12, fontWeight: ev.concluido ? 500 : 400, color: statusLabel.color }}
                  >
                    {statusLabel.txt}
                  </div>
                </div>
              );
            })}
            {detailEvs.length === 0 && (
              <div className="text-[12px] text-[#6b7280] text-center py-4">Sem eventos.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <RegistrarSessaoModal
        open={sessaoOpen}
        onOpenChange={setSessaoOpen}
        segundosTotais={sessaoSegundos}
        eventosPendentes={eventosHoje
          .filter((e) => !e.concluido)
          .map((e) => {
            const t = e.topico_id ? topicoById.get(e.topico_id) : undefined;
            return {
              id: e.id,
              titulo: e.titulo,
              topico_id: e.topico_id,
              materia_nome: e.materia_nome,
              concluido: e.concluido,
              fontes: t?.fontes ?? [],
            };
          })}
        userId={userId}
        onSaved={onChange}
      />

      <LimparEventosModal
        open={limparOpen}
        onOpenChange={setLimparOpen}
        userId={userId}
        cronogramaId={cronogramaId}
        topicoIds={topicos.map((t) => t.id)}
        onCleared={onChange}
      />
    </div>
  );
}
