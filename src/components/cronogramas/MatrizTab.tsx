import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCorMateriaPastel, type MateriaPastel } from "@/lib/materia-color";
import { NovoTopicoForm, type Fonte, type TopicoEditavel } from "./NovoTopicoForm";

export type MatrizTopico = {
  id: string;
  titulo: string;
  ordem: number;
  horas_estimadas: number;
  fontes: Fonte[];
  materia_id: string;
  materia_nome: string;
  materia_cor: string | null;
};

type Props = {
  cronogramaId: string;
  topicos: MatrizTopico[];
  materias: { id: string; nome: string }[];
  progresso: Record<string, boolean>;
  fonteProgresso: Record<string, boolean>; // key = `${topicoId}:${sigla}`
  canEdit: boolean;
  userId: string | null;
  onChange: () => void;
};

/** Ajusta uma cor hex para uma versão pastel clara (mistura com branco). */
function pastelFromHex(hex: string, mixWhite = 0.85): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return "#F1EFE8";
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * mixWhite);
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/** Escurece uma cor hex (usado para texto legível). */
function darkenHex(hex: string, amount = 0.55): string {
  const m = hex.replace("#", "");
  if (m.length !== 6) return "#1f2937";
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  const dk = (c: number) => Math.max(0, Math.round(c * (1 - amount)));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(dk(r))}${toHex(dk(g))}${toHex(dk(b))}`;
}

/** Resolve a paleta do card priorizando a cor salva no banco da matéria. */
function resolvePaleta(materiaNome: string, materiaCor: string | null): MateriaPastel {
  if (materiaCor && /^#[0-9a-fA-F]{6}$/.test(materiaCor)) {
    return {
      border: materiaCor,
      background: pastelFromHex(materiaCor, 0.85),
      color: darkenHex(materiaCor, 0.55),
    };
  }
  return getCorMateriaPastel(materiaNome);
}

export function MatrizTab({
  cronogramaId,
  topicos,
  materias,
  progresso,
  fonteProgresso,
  canEdit,
  userId,
  onChange,
}: Props) {
  const [items, setItems] = useState(topicos);
  const [editingTopico, setEditingTopico] = useState<TopicoEditavel | null>(null);
  const [adicionandoNovo, setAdicionandoNovo] = useState(false);
  const [notas, setNotas] = useState<Record<string, string>>({});

  useEffect(() => setItems(topicos), [topicos]);

  // Carrega notas do usuário para os tópicos visíveis
  useEffect(() => {
    if (!userId || topicos.length === 0) {
      setNotas({});
      return;
    }
    let cancelled = false;
    (async () => {
      const ids = topicos.map((t) => t.id);
      const { data } = await supabase
        .from("user_notas")
        .select("topico_id, nota")
        .eq("user_id", userId)
        .in("topico_id", ids);
      if (cancelled) return;
      const map: Record<string, string> = {};
      (data ?? []).forEach((n) => {
        map[n.topico_id] = n.nota ?? "";
      });
      setNotas(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, topicos]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const concluidos = useMemo(
    () => items.filter((t) => progresso[t.id]).length,
    [items, progresso],
  );
  const total = items.length;
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  async function toggleTopico(topicoId: string, novoValor: boolean) {
    if (!userId) return toast.error("Faça login para marcar progresso");
    const { error } = await supabase.from("user_topico_progresso").upsert(
      {
        user_id: userId,
        topico_id: topicoId,
        concluido: novoValor,
        concluido_em: novoValor ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,topico_id" },
    );
    if (error) return toast.error(error.message);

    await supabase
      .from("user_calendar_events")
      .update({ concluido: novoValor })
      .eq("user_id", userId)
      .eq("topico_id", topicoId);

    onChange();
  }

  async function toggleFonte(topicoId: string, sigla: string, novoValor: boolean) {
    if (!userId) return toast.error("Faça login para marcar progresso");
    const { error } = await supabase.from("user_fonte_progress").upsert(
      { user_id: userId, topico_id: topicoId, sigla, concluido: novoValor },
      { onConflict: "user_id,topico_id,sigla" },
    );
    if (error) return toast.error(error.message);
    onChange();
  }

  async function delTopico(id: string) {
    if (!confirm("Excluir este tópico?")) return;
    const { error } = await supabase.from("cronograma_topicos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  }

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
    await Promise.all(
      newItems.map((t, idx) =>
        supabase.from("cronograma_topicos").update({ ordem: idx }).eq("id", t.id),
      ),
    );
    onChange();
  }

  // Notas — debounce manual por tópico
  const notaTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function handleNotaChange(topicoId: string, value: string) {
    setNotas((prev) => ({ ...prev, [topicoId]: value }));
    if (!userId) return;
    if (notaTimers.current[topicoId]) clearTimeout(notaTimers.current[topicoId]);
    notaTimers.current[topicoId] = setTimeout(async () => {
      const { error } = await supabase.from("user_notas").upsert(
        { user_id: userId, topico_id: topicoId, nota: value },
        { onConflict: "user_id,topico_id" },
      );
      if (error) toast.error("Erro ao salvar nota: " + error.message);
    }, 800);
  }

  if (items.length === 0) {
    return (
      <>
        <div className="lei-card text-center py-12 text-text-muted text-[13px]">
          Este cronograma ainda não tem tópicos.
        </div>
        {canEdit && (
          <NovoTopicoForm cronogramaId={cronogramaId} materias={materias} onAdded={onChange} />
        )}
      </>
    );
  }

  return (
    <div>
      {/* Progress bar */}
      <div className="lei-card mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] text-text-main font-medium">
            {concluidos} de {total} tópicos concluídos
          </span>
          <span className="text-[13px] text-text-muted">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-sage-dark"
            style={{ width: `${pct}%`, transition: "width 0.4s ease" }}
          />
        </div>
      </div>

      {/* Cards horizontais */}
      <div
        className="overflow-x-auto pb-3"
        style={{ scrollbarWidth: "thin" }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex gap-3" style={{ minWidth: "min-content" }}>
              {items.map((t, idx) => (
                <CardCiclo
                  key={t.id}
                  topico={t}
                  index={idx + 1}
                  concluido={!!progresso[t.id]}
                  fonteProgresso={fonteProgresso}
                  nota={notas[t.id] ?? ""}
                  canEdit={canEdit}
                  onToggle={(v) => toggleTopico(t.id, v)}
                  onToggleFonte={(sigla, v) => toggleFonte(t.id, sigla, v)}
                  onNotaChange={(v) => handleNotaChange(t.id, v)}
                  onStartEdit={() =>
                    setEditingTopico({
                      id: t.id,
                      materia_id: t.materia_id,
                      materia_nome: t.materia_nome,
                      titulo: t.titulo,
                      horas_estimadas: t.horas_estimadas,
                      fontes: t.fontes,
                      ordem: t.ordem,
                      totalNaMateria: items.filter((x) => x.materia_id === t.materia_id).length,
                    })
                  }
                  onDelete={() => delTopico(t.id)}
                />
              ))}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => setAdicionandoNovo(true)}
                  className="rounded-[14px] flex flex-col items-center justify-center gap-2 transition-all"
                  style={{
                    width: 220,
                    minWidth: 220,
                    minHeight: 280,
                    background: "var(--card)",
                    border: "2px dashed var(--border)",
                    color: "var(--text-muted, #8A8478)",
                    flexShrink: 0,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#B8C9B0";
                    e.currentTarget.style.color = "#7A9A70";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.color = "var(--text-muted, #8A8478)";
                  }}
                >
                  <Plus size={22} />
                  <span className="text-[11px] font-medium">Adicionar ciclo</span>
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Dialog edição */}
      <Dialog
        open={!!editingTopico}
        onOpenChange={(o) => !o && setEditingTopico(null)}
      >
        <DialogContent className="bg-card max-w-3xl rounded-[14px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-[18px] text-text-main">
              Editar tópico
            </DialogTitle>
          </DialogHeader>
          {editingTopico && (
            <NovoTopicoForm
              key={editingTopico.id}
              cronogramaId={cronogramaId}
              materias={materias}
              editing={editingTopico}
              embedded
              onCancelEdit={() => setEditingTopico(null)}
              onAdded={() => {
                setEditingTopico(null);
                onChange();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog novo ciclo */}
      <Dialog open={adicionandoNovo} onOpenChange={setAdicionandoNovo}>
        <DialogContent className="bg-card max-w-3xl rounded-[14px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-[18px] text-text-main">
              Novo tópico
            </DialogTitle>
          </DialogHeader>
          <NovoTopicoForm
            cronogramaId={cronogramaId}
            materias={materias}
            embedded
            onAdded={() => {
              setAdicionandoNovo(false);
              onChange();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

type CardProps = {
  topico: MatrizTopico;
  index: number;
  concluido: boolean;
  fonteProgresso: Record<string, boolean>;
  nota: string;
  canEdit: boolean;
  onToggle: (v: boolean) => void;
  onToggleFonte: (sigla: string, v: boolean) => void;
  onNotaChange: (v: string) => void;
  onStartEdit: () => void;
  onDelete: () => void;
};

function CardCiclo({
  topico,
  index,
  concluido,
  fonteProgresso,
  nota,
  canEdit,
  onToggle,
  onToggleFonte,
  onNotaChange,
  onStartEdit,
  onDelete,
}: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topico.id,
  });
  const cor = resolvePaleta(topico.materia_nome, topico.materia_cor);

  const mutedBorder = "#e5e7eb";
  const mutedText = "#9ca3af";
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? "all 0.25s ease",
    opacity: isDragging ? 0.5 : concluido ? 0.65 : 1,
    width: 240,
    minWidth: 240,
    flexShrink: 0,
    background: "#fff",
    borderRadius: 14,
    border: `1px solid ${concluido ? mutedBorder : cor.border}`,
    borderTop: `4px solid ${concluido ? mutedBorder : cor.border}`,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 12,
  };

  const fontesSemLink = topico.fontes.filter(
    (f) =>
      !(f.link_questoes ||
        (f.links_questoes && f.links_questoes.some((l) => !!l)) ||
        f.link_dod ||
        (f.links_dod && f.links_dod.some((l) => !!l))),
  );
  const linksQuestoes = topico.fontes.flatMap((f) => {
    const arr =
      f.links_questoes && f.links_questoes.length > 0
        ? f.links_questoes
        : f.link_questoes
          ? [f.link_questoes]
          : [];
    return arr.filter(Boolean).map((url) => ({ sigla: f.sigla, descricao: f.descricao, url }));
  });
  const linksDod = topico.fontes.flatMap((f) => {
    const arr =
      f.links_dod && f.links_dod.length > 0
        ? f.links_dod
        : f.link_dod
          ? [f.link_dod]
          : [];
    return arr.filter(Boolean).map((url) => ({ sigla: f.sigla, descricao: f.descricao, url }));
  });

  return (
    <div ref={setNodeRef} style={style}>
      {/* CABEÇALHO */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
            style={{
              background: concluido ? "transparent" : cor.background,
              color: concluido ? "#c4c4c4" : cor.color,
              fontFamily: concluido ? "'Playfair Display', serif" : undefined,
              fontSize: concluido ? 14 : undefined,
              transition: "all 0.25s ease",
            }}
          >
            {String(index).padStart(2, "0")}
          </span>
          <span
            className="text-[11px] font-semibold truncate"
            style={{
              color: concluido ? mutedText : cor.color,
              transition: "color 0.25s ease",
            }}
            title={topico.materia_nome}
          >
            {topico.materia_nome}
          </span>
        </div>
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-text-muted hover:text-text-main p-0.5"
            aria-label="Arrastar"
          >
            <GripVertical size={13} />
          </button>
        )}
      </div>

      <div
        className="text-[12px] font-medium leading-snug"
        style={{
          color: concluido ? mutedText : "var(--text-main)",
          textDecoration: concluido ? "line-through" : undefined,
          transition: "color 0.25s ease",
        }}
      >
        {topico.titulo}
      </div>

      {topico.horas_estimadas > 0 && (
        <div
          className="text-[10px]"
          style={{ color: concluido ? mutedText : "var(--text-muted, #8A8478)" }}
        >
          {topico.horas_estimadas}h estimadas
        </div>
      )}

      {/* FONTES — fundo pastel */}
      {fontesSemLink.length > 0 && (
        <div
          className="rounded-[8px] flex flex-col gap-1.5"
          style={{
            background: cor.background,
            padding: "7px 8px",
            opacity: concluido ? 0.5 : 1,
            transition: "opacity 0.25s ease",
          }}
        >
          {fontesSemLink.map((fonte, i) => {
            const key = `${topico.id}:${fonte.sigla}`;
            const done = !!fonteProgresso[key];
            return (
              <label
                key={i}
                className="flex items-start gap-1.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={done}
                  onChange={(e) => onToggleFonte(fonte.sigla, e.target.checked)}
                  style={{ accentColor: cor.border, marginTop: 2, flexShrink: 0 }}
                />
                <span
                  className="text-[10px] font-bold"
                  style={{ color: cor.color, minWidth: 32 }}
                >
                  {fonte.sigla}
                </span>
                <span
                  className="text-[10px] flex-1"
                  style={{
                    color: cor.color,
                    opacity: 0.85,
                    textDecoration: done ? "line-through" : undefined,
                  }}
                >
                  {fonte.descricao}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {/* QUESTÕES */}
      {linksQuestoes.length > 0 && (
        <div
          className="flex flex-col gap-1"
          style={{ opacity: concluido ? 0.4 : 1, transition: "opacity 0.25s ease" }}
        >
          <div className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">
            Questões
          </div>
          <div className="flex flex-wrap gap-1">
            {linksQuestoes.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full hover:underline"
                style={{ background: "#F1EFE8", color: "#378ADD" }}
              >
                <ExternalLink size={9} />
                {l.sigla || `Q${i + 1}`}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* DOD */}
      {linksDod.length > 0 && (
        <div
          className="flex flex-col gap-1"
          style={{ opacity: concluido ? 0.4 : 1, transition: "opacity 0.25s ease" }}
        >
          <div className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">
            DOD
          </div>
          <div className="flex flex-wrap gap-1">
            {linksDod.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full hover:underline"
                style={{ background: "#F1EFE8", color: "#378ADD" }}
              >
                📖 {l.descricao || l.sigla || `DOD ${i + 1}`}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* NOTAS */}
      <div className="flex flex-col gap-1">
        <div className="text-[9px] uppercase tracking-wider text-text-muted font-semibold">
          Notas
        </div>
        <textarea
          value={nota}
          onChange={(e) => onNotaChange(e.target.value)}
          placeholder="Adicione suas anotações..."
          style={{
            width: "100%",
            minHeight: 56,
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: 7,
            fontSize: 10,
            color: "#374151",
            background: "#fafafa",
            resize: "vertical",
            fontFamily: "inherit",
            outline: "none",
          }}
          onFocus={(e) => (e.target.style.borderColor = cor.border)}
          onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
        />
      </div>

      {/* RODAPÉ */}
      <div
        className="flex items-center justify-between pt-1.5"
        style={{ borderTop: "1px solid #f3f4f6" }}
      >
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={concluido}
            onChange={(e) => onToggle(e.target.checked)}
            style={{ accentColor: "#1D9E75" }}
          />
          <span
            className="text-[10px] font-medium"
            style={{ color: concluido ? "#1D9E75" : "#8A8478" }}
          >
            {concluido ? "Concluído ✓" : "Concluir"}
          </span>
        </label>
        {canEdit && (
          <div
            className="flex gap-1"
            style={{ opacity: concluido ? 0.4 : 1, transition: "opacity 0.25s ease" }}
          >
            <button
              onClick={onStartEdit}
              className="text-text-muted hover:text-text-main p-0.5"
              aria-label="Editar"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={onDelete}
              className="text-text-muted hover:text-destructive p-0.5"
              aria-label="Excluir"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
