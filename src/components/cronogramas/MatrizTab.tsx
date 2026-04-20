import { useEffect, useMemo, useState } from "react";
import { ExternalLink, GripVertical, Pencil, Trash2, Check, X } from "lucide-react";
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
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { colorForMateria } from "@/lib/materia-color";
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

  useEffect(() => setItems(topicos), [topicos]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const concluidos = useMemo(
    () => items.filter((t) => progresso[t.id]).length,
    [items, progresso],
  );
  const total = items.length;
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  async function toggleTopico(topicoId: string, novoValor: boolean) {
    if (!userId) return toast.error("Faça login para marcar progresso");
    // Optimistic UI handled by parent reload; do upsert + sync calendar
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

    // Sync calendar events (skip is_revisao=true if column existed; we don't track yet)
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

  // edição agora ocorre via dialog (NovoTopicoForm em modo edit)

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const newItems = arrayMove(items, oldIndex, newIndex);
    setItems(newItems);
    // Update ordem in batch
    await Promise.all(
      newItems.map((t, idx) =>
        supabase.from("cronograma_topicos").update({ ordem: idx }).eq("id", t.id),
      ),
    );
    onChange();
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

      <div className="lei-card overflow-x-auto p-0">
        <table className="w-full text-[13px]" style={{ minWidth: 920 }}>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wider text-text-muted">
              {canEdit && <th className="w-8 py-2 px-2"></th>}
              <th className="w-10 py-2 px-2"></th>
              <th className="w-12 py-2 px-2">#</th>
              <th className="py-2 px-2" style={{ minWidth: 140 }}>Matéria</th>
              <th className="py-2 px-2" style={{ minWidth: 220 }}>Assunto</th>
              <th className="py-2 px-2" style={{ minWidth: 240 }}>Fonte Legal</th>
              <th className="py-2 px-2 w-20">Questões</th>
              <th className="py-2 px-2 w-20">DOD</th>
              {canEdit && <th className="py-2 px-2 w-20">Ações</th>}
            </tr>
          </thead>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <tbody>
                {items.map((t, idx) => (
                  <SortableRow
                    key={t.id}
                    topico={t}
                    index={idx + 1}
                    concluido={!!progresso[t.id]}
                    fonteProgresso={fonteProgresso}
                    canEdit={canEdit}
                    onStartEdit={() =>
                      setEditingTopico({
                        id: t.id,
                        materia_id: t.materia_id,
                        materia_nome: t.materia_nome,
                        titulo: t.titulo,
                        horas_estimadas: t.horas_estimadas,
                        fontes: t.fontes,
                      })
                    }
                    onToggle={(v) => toggleTopico(t.id, v)}
                    onToggleFonte={(sigla, v) => toggleFonte(t.id, sigla, v)}
                    onDelete={() => delTopico(t.id)}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {canEdit && (
        <NovoTopicoForm cronogramaId={cronogramaId} materias={materias} onAdded={onChange} />
      )}

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
    </div>
  );
}

type RowProps = {
  topico: MatrizTopico;
  index: number;
  concluido: boolean;
  fonteProgresso: Record<string, boolean>;
  canEdit: boolean;
  onStartEdit: () => void;
  onToggle: (v: boolean) => void;
  onToggleFonte: (sigla: string, v: boolean) => void;
  onDelete: () => void;
};

function SortableRow({
  topico,
  index,
  concluido,
  fonteProgresso,
  canEdit,
  onStartEdit,
  onToggle,
  onToggleFonte,
  onDelete,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: topico.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: concluido ? "rgba(0,0,0,0.04)" : undefined,
  };
  const cor = colorForMateria(topico.materia_nome, topico.materia_cor);
  const inactiveColor = "#9ca3af";

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className="border-b border-border align-top"
    >
      {canEdit && (
        <td className="py-3 px-2 align-top">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-text-muted hover:text-text-main p-1"
            aria-label="Arrastar"
          >
            <GripVertical size={14} />
          </button>
        </td>
      )}
      <td className="py-3 px-2 align-top">
        <Checkbox
          checked={concluido}
          onCheckedChange={(v) => onToggle(!!v)}
          className={
            concluido ? "data-[state=checked]:bg-[#1D9E75] border-[#1D9E75]" : ""
          }
        />
      </td>
      <td
        className="py-3 px-2 align-top text-[12px]"
        style={{ color: concluido ? inactiveColor : undefined }}
      >
        {index}
      </td>
      <td className="py-3 px-2 align-top">
        <span
          className="inline-block text-[11px] font-medium rounded px-2 py-1 text-white"
          style={{
            background: concluido ? "#e5e7eb" : cor,
            color: concluido ? inactiveColor : "white",
            maxWidth: 140,
            width: "fit-content",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={topico.materia_nome}
        >
          {topico.materia_nome}
        </span>
      </td>
      <td
        className="py-3 px-2 align-top"
        style={{
          color: concluido ? inactiveColor : undefined,
          textDecoration: concluido ? "line-through" : undefined,
          transition: "all 0.25s ease",
        }}
      >
        <div>{topico.titulo}</div>
        {topico.horas_estimadas > 0 && (
          <div className="text-[11px] text-text-muted mt-0.5">
            {topico.horas_estimadas}h estimadas
          </div>
        )}
      </td>
      <td className="py-3 px-2 align-top">
        {topico.fontes.length === 0 ? (
          <span className="text-[12px] text-text-muted">—</span>
        ) : (
          <div className="flex flex-col gap-2">
            {topico.fontes.map((f, i) => {
              const key = `${topico.id}:${f.sigla}`;
              const done = !!fonteProgresso[key];
              return (
                <div key={i} className="flex items-start gap-2">
                  <Checkbox
                    checked={done}
                    onCheckedChange={(v) => onToggleFonte(f.sigla, !!v)}
                    className="mt-0.5"
                  />
                  <span
                    className="font-semibold text-[12px]"
                    style={{ minWidth: 40, color: done || concluido ? inactiveColor : undefined }}
                  >
                    {f.sigla}
                  </span>
                  <span
                    className="text-[12px]"
                    style={{
                      color: "#6b7280",
                      textDecoration: done ? "line-through" : undefined,
                    }}
                  >
                    {f.descricao}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </td>
      <td className="py-3 px-2 align-top">
        {topico.fontes.some((f) => f.link_questoes) ? (
          <div className="flex flex-col gap-2">
            {topico.fontes.map((f, i) =>
              f.link_questoes ? (
                <a
                  key={i}
                  href={f.link_questoes}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-[#378ADD] hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink size={11} /> {f.sigla}
                </a>
              ) : (
                <span key={i} className="text-[12px] text-text-muted">—</span>
              ),
            )}
          </div>
        ) : (
          <span className="text-[12px] text-text-muted">—</span>
        )}
      </td>
      <td className="py-3 px-2 align-top">
        {topico.fontes.some((f) => f.link_dod) ? (
          <div className="flex flex-col gap-2">
            {topico.fontes.map((f, i) =>
              f.link_dod ? (
                <a
                  key={i}
                  href={f.link_dod}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-[#378ADD] hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink size={11} /> {f.sigla}
                </a>
              ) : (
                <span key={i} className="text-[12px] text-text-muted">—</span>
              ),
            )}
          </div>
        ) : (
          <span className="text-[12px] text-text-muted">—</span>
        )}
      </td>
      {canEdit && (
        <td className="py-3 px-2 align-top">
          <div className="flex gap-1">
            <button
              onClick={onStartEdit}
              className="text-text-muted hover:text-text-main p-1"
              aria-label="Editar"
            >
              <Pencil size={13} />
            </button>
            <button
              onClick={onDelete}
              className="text-text-muted hover:text-destructive p-1"
              aria-label="Excluir"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}
