import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { colorForMateria } from "@/lib/materia-color";

export type Fonte = {
  sigla: string;
  descricao: string;
  /** Legado: link único de questões. Mantido para retrocompatibilidade. */
  link_questoes: string;
  /** Legado: link único do DOD. Mantido para retrocompatibilidade. */
  link_dod: string;
  /** Múltiplos links de questões. Quando presente, prevalece sobre link_questoes. */
  links_questoes?: string[];
  /** Múltiplos links DOD. Quando presente, prevalece sobre link_dod. */
  links_dod?: string[];
};

export type TopicoEditavel = {
  id: string;
  materia_id: string;
  materia_nome: string;
  titulo: string;
  horas_estimadas: number;
  fontes: Fonte[];
  doutrina?: string[];
  atencao?: string | null;
  ordem?: number;
  totalNaMateria?: number;
};

type Props = {
  cronogramaId: string;
  materias: { id: string; nome: string }[];
  onAdded: () => void;
  /** Quando definido, o form opera em modo edição. */
  editing?: TopicoEditavel | null;
  onCancelEdit?: () => void;
  /** Esconde o card visual externo (útil dentro de Dialog). */
  embedded?: boolean;
};

type FonteRow = Fonte & { _key: string };

let _rowKeySeq = 0;
const newRowKey = () => `f_${Date.now()}_${++_rowKeySeq}`;

function normalizeFonteIn(f: Fonte): FonteRow {
  const lq = f.links_questoes && f.links_questoes.length > 0
    ? f.links_questoes
    : f.link_questoes
      ? [f.link_questoes]
      : [""];
  const ld = f.links_dod && f.links_dod.length > 0
    ? f.links_dod
    : f.link_dod
      ? [f.link_dod]
      : [""];
  return {
    sigla: f.sigla ?? "",
    descricao: f.descricao ?? "",
    link_questoes: f.link_questoes ?? "",
    link_dod: f.link_dod ?? "",
    links_questoes: lq,
    links_dod: ld,
    _key: newRowKey(),
  };
}

function emptyRow(): FonteRow {
  return {
    sigla: "",
    descricao: "",
    link_questoes: "",
    link_dod: "",
    links_questoes: [""],
    links_dod: [""],
    _key: newRowKey(),
  };
}

export function NovoTopicoForm({
  cronogramaId,
  materias,
  onAdded,
  editing = null,
  onCancelEdit,
  embedded = false,
}: Props) {
  const isEdit = !!editing;
  const [materia, setMateria] = useState(editing?.materia_nome ?? "");
  const [assunto, setAssunto] = useState(editing?.titulo ?? "");
  const [horas, setHoras] = useState(editing?.horas_estimadas ?? 3);
  const [posicao, setPosicao] = useState<number>(
    editing ? (editing.ordem ?? 0) + 1 : 1,
  );
  const [fontes, setFontes] = useState<FonteRow[]>(
    editing?.fontes && editing.fontes.length > 0
      ? editing.fontes.map(normalizeFonteIn)
      : [emptyRow()],
  );
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function updateFonteField(i: number, key: "sigla" | "descricao", value: string) {
    setFontes((f) => f.map((x, idx) => (idx === i ? { ...x, [key]: value } : x)));
  }
  function updateFonteLink(
    i: number,
    field: "links_questoes" | "links_dod",
    linkIdx: number,
    value: string,
  ) {
    setFontes((f) =>
      f.map((x, idx) => {
        if (idx !== i) return x;
        const arr = [...(x[field] ?? [""])];
        arr[linkIdx] = value;
        return { ...x, [field]: arr };
      }),
    );
  }
  function addLink(i: number, field: "links_questoes" | "links_dod") {
    setFontes((f) =>
      f.map((x, idx) => {
        if (idx !== i) return x;
        const arr = [...(x[field] ?? []), ""];
        return { ...x, [field]: arr };
      }),
    );
  }
  function removeLink(i: number, field: "links_questoes" | "links_dod", linkIdx: number) {
    setFontes((f) =>
      f.map((x, idx) => {
        if (idx !== i) return x;
        const arr = (x[field] ?? []).filter((_, k) => k !== linkIdx);
        return { ...x, [field]: arr.length > 0 ? arr : [""] };
      }),
    );
  }
  function addFonte() {
    setFontes((f) => [...f, emptyRow()]);
  }
  function removeFonte(i: number) {
    setFontes((f) => f.filter((_, idx) => idx !== i));
  }
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setFontes((f) => {
      const oldIndex = f.findIndex((x) => x._key === active.id);
      const newIndex = f.findIndex((x) => x._key === over.id);
      if (oldIndex < 0 || newIndex < 0) return f;
      return arrayMove(f, oldIndex, newIndex);
    });
  }

  function resetForm() {
    setMateria("");
    setAssunto("");
    setHoras(3);
    setFontes([emptyRow()]);
  }

  async function save() {
    if (!materia.trim() || !assunto.trim()) {
      toast.error("Preencha matéria e assunto");
      return;
    }
    setSaving(true);
    try {
      // Find or create matéria (sempre garante cor determinística)
      const corDeterministica = colorForMateria(materia.trim());
      let materiaId = materias.find(
        (m) => m.nome.toLowerCase() === materia.trim().toLowerCase(),
      )?.id;
      if (!materiaId) {
        const { data: novaM, error: errM } = await supabase
          .from("cronograma_materias")
          .insert({
            cronograma_id: cronogramaId,
            nome: materia.trim(),
            cor: corDeterministica,
            ordem: materias.length,
          })
          .select("id")
          .single();
        if (errM) throw errM;
        materiaId = novaM.id;
      } else {
        // Garante que a cor armazenada esteja sempre correta
        await supabase
          .from("cronograma_materias")
          .update({ cor: corDeterministica })
          .eq("id", materiaId);
      }

      const fontesClean = fontes
        .filter((f) => f.sigla.trim() || f.descricao.trim())
        .map((f) => {
          const linksQ = (f.links_questoes ?? [])
            .map((s) => s.trim())
            .filter(Boolean);
          const linksD = (f.links_dod ?? [])
            .map((s) => s.trim())
            .filter(Boolean);
          return {
            sigla: f.sigla.trim(),
            descricao: f.descricao.trim(),
            // Mantém compat: primeiro link nas chaves antigas
            link_questoes: linksQ[0] ?? "",
            link_dod: linksD[0] ?? "",
            links_questoes: linksQ,
            links_dod: linksD,
          };
        });

      if (isEdit && editing) {
        const materiaChanged = materiaId !== editing.materia_id;
        const oldOrdem = editing.ordem ?? 0;
        const newOrdem = Math.max(0, (posicao || 1) - 1);

        const { error } = await supabase
          .from("cronograma_topicos")
          .update({
            materia_id: materiaId,
            titulo: assunto.trim(),
            horas_estimadas: horas,
            fontes: fontesClean,
          })
          .eq("id", editing.id);
        if (error) throw error;

        if (materiaChanged || newOrdem !== oldOrdem) {
          const { data: irmaos } = await supabase
            .from("cronograma_topicos")
            .select("id, ordem")
            .eq("materia_id", materiaId)
            .order("ordem", { ascending: true });

          const lista = (irmaos ?? []).filter((t) => t.id !== editing.id);
          const insertAt = Math.min(newOrdem, lista.length);
          lista.splice(insertAt, 0, { id: editing.id, ordem: 0 });
          await Promise.all(
            lista.map((t, idx) =>
              supabase.from("cronograma_topicos").update({ ordem: idx }).eq("id", t.id),
            ),
          );
        }
        toast.success("Tópico atualizado");
      } else {
        const { count } = await supabase
          .from("cronograma_topicos")
          .select("*", { count: "exact", head: true })
          .eq("materia_id", materiaId);

        const { error } = await supabase.from("cronograma_topicos").insert({
          materia_id: materiaId,
          titulo: assunto.trim(),
          ordem: count ?? 0,
          horas_estimadas: horas,
          fontes: fontesClean,
        });
        if (error) throw error;
        resetForm();
        toast.success("Tópico adicionado");
      }
      onAdded();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const containerClass = embedded ? "" : "lei-card mt-4";

  return (
    <div className={containerClass}>
      {!embedded && (
        <h3 className="font-serif text-[15px] text-text-main mb-3">
          {isEdit ? "Editar tópico" : "Adicionar tópico"}
        </h3>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="text-[11px] text-text-muted mb-1 block">Matéria</label>
          <Input
            list="materias-list"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            placeholder="Ex: Direito Constitucional"
            className="bg-background h-9"
          />
          <datalist id="materias-list">
            {materias.map((m) => (
              <option key={m.id} value={m.nome} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-[11px] text-text-muted mb-1 block">Assunto</label>
          <Input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Ex: Princípios fundamentais"
            className="bg-background h-9"
          />
        </div>
        <div>
          <label className="text-[11px] text-text-muted mb-1 block">Horas estimadas</label>
          <Input
            type="number"
            min={1}
            value={horas}
            onChange={(e) => setHoras(Number(e.target.value) || 3)}
            className="bg-background h-9"
          />
        </div>
      </div>

      {isEdit && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="text-[11px] text-text-muted mb-1 block">
              Posição na matéria
            </label>
            <Input
              type="number"
              min={1}
              value={posicao}
              onChange={(e) => setPosicao(Math.max(1, Number(e.target.value) || 1))}
              className="bg-background h-9"
            />
            <span className="text-[10px] text-text-muted mt-1 block">
              Define a ordem do tópico dentro da matéria selecionada.
            </span>
          </div>
        </div>
      )}

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-medium text-text-main">Fontes legais</span>
          <Button size="sm" variant="outline" onClick={addFonte} className="h-7 text-[11px]">
            <Plus size={12} /> Adicionar fonte
          </Button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={fontes.map((f) => f._key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-2">
              {fontes.map((f, i) => (
                <SortableFonteRow
                  key={f._key}
                  fonte={f}
                  onUpdateField={(k, v) => updateFonteField(i, k, v)}
                  onUpdateLink={(field, idx, v) => updateFonteLink(i, field, idx, v)}
                  onAddLink={(field) => addLink(i, field)}
                  onRemoveLink={(field, idx) => removeLink(i, field, idx)}
                  onRemoveRow={() => removeFonte(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        {isEdit && onCancelEdit && (
          <Button variant="outline" onClick={onCancelEdit} disabled={saving}>
            Cancelar
          </Button>
        )}
        <Button
          onClick={save}
          disabled={saving}
          className="bg-sage-dark hover:bg-sage-dark/90 text-white"
        >
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Adicionar tópico"}
        </Button>
      </div>
    </div>
  );
}

type SortableFonteRowProps = {
  fonte: FonteRow;
  onUpdateField: (k: "sigla" | "descricao", v: string) => void;
  onUpdateLink: (field: "links_questoes" | "links_dod", idx: number, v: string) => void;
  onAddLink: (field: "links_questoes" | "links_dod") => void;
  onRemoveLink: (field: "links_questoes" | "links_dod", idx: number) => void;
  onRemoveRow: () => void;
};

function SortableFonteRow({
  fonte,
  onUpdateField,
  onUpdateLink,
  onAddLink,
  onRemoveLink,
  onRemoveRow,
}: SortableFonteRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: fonte._key });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const linksQ = fonte.links_questoes ?? [""];
  const linksD = fonte.links_dod ?? [""];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="grid grid-cols-[18px_80px_1fr_1fr_1fr_28px] gap-2 items-start"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-text-muted hover:text-text-main p-1 mt-1"
        aria-label="Arrastar fonte"
        type="button"
      >
        <GripVertical size={14} />
      </button>
      <Input
        value={fonte.sigla}
        onChange={(e) => onUpdateField("sigla", e.target.value)}
        placeholder="CF"
        className="bg-background h-8 text-[12px] font-semibold"
      />
      <Input
        value={fonte.descricao}
        onChange={(e) => onUpdateField("descricao", e.target.value)}
        placeholder="Art.1 ao Art.4"
        className="bg-background h-8 text-[12px]"
      />
      <MultiLinkColumn
        values={linksQ}
        placeholder="Link questões"
        onChange={(idx, v) => onUpdateLink("links_questoes", idx, v)}
        onAdd={() => onAddLink("links_questoes")}
        onRemove={(idx) => onRemoveLink("links_questoes", idx)}
      />
      <MultiLinkColumn
        values={linksD}
        placeholder="Link DOD"
        onChange={(idx, v) => onUpdateLink("links_dod", idx, v)}
        onAdd={() => onAddLink("links_dod")}
        onRemove={(idx) => onRemoveLink("links_dod", idx)}
      />
      <button
        onClick={onRemoveRow}
        className="text-text-muted hover:text-destructive p-1 mt-1"
        aria-label="Remover fonte"
        type="button"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function MultiLinkColumn({
  values,
  placeholder,
  onChange,
  onAdd,
  onRemove,
}: {
  values: string[];
  placeholder: string;
  onChange: (idx: number, v: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {values.map((v, idx) => (
        <div key={idx} className="flex items-center gap-1">
          <Input
            value={v}
            onChange={(e) => onChange(idx, e.target.value)}
            placeholder={placeholder}
            className="bg-background h-8 text-[12px]"
          />
          {values.length > 1 && (
            <button
              type="button"
              onClick={() => onRemove(idx)}
              className="text-text-muted hover:text-destructive p-0.5"
              aria-label="Remover link"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="text-[10px] text-text-muted hover:text-text-main inline-flex items-center gap-1 self-start mt-0.5"
      >
        <Plus size={10} /> link
      </button>
    </div>
  );
}
