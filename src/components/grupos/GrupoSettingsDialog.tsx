import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { calcularNivel, getNivelInfo, concederXP, XP_CONFIG } from "@/lib/xp";
import { toast } from "sonner";
import {
  Settings,
  Copy,
  RefreshCw,
  Trash2,
  UserMinus,
  Plus,
  Pencil,
  Crown,
  Loader2,
} from "lucide-react";

type GrupoFull = {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  codigo_convite: string;
  criado_por: string;
  max_membros: number;
};

type MembroSimples = {
  user_id: string;
  role: string;
  nome: string;
  avatar_url: string | null;
  xp_total: number;
  nivel: number;
};

type MetaCustom = {
  id: string;
  titulo: string | null;
  tipo: string;
  valor_alvo: number;
  valor_atual: number;
  fim: string;
  concluida: boolean;
  xp_distribuido: boolean;
};

type DesafioRow = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string;
  ativo: boolean;
  xp_recompensa: number;
  total_concluidos: number;
};

const METAS_PADRAO_INFO = [
  { emoji: "🕐", titulo: "200 horas coletivas no mês", alvo: 200, unidade: "h", tipo: "horas" as const },
  { emoji: "✏️", titulo: "1.000 questões coletivas na semana", alvo: 1000, unidade: "q", tipo: "questoes" as const },
  { emoji: "🔥", titulo: "Todos com streak de 7 dias", alvo: 7, unidade: "dias", tipo: "streak" as const },
  { emoji: "📚", titulo: "50 tópicos concluídos na semana", alvo: 50, unidade: "tópicos", tipo: "topicos" as const },
];

export function GrupoSettingsDialog({
  open,
  onOpenChange,
  grupo,
  agregados,
  onChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  grupo: GrupoFull;
  agregados: { horas_mes: number; questoes_semana: number; topicos_semana: number; streak_grupo: number };
  onChange: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[640px] rounded-[14px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[18px] text-text-main flex items-center gap-2">
            <Settings size={18} /> Configurações do grupo
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="grupo" className="mt-2">
          <TabsList className="bg-muted rounded-[12px] p-1">
            <TabsTrigger value="grupo" className="rounded-[10px]">Grupo</TabsTrigger>
            <TabsTrigger value="membros" className="rounded-[10px]">Membros</TabsTrigger>
            <TabsTrigger value="metas" className="rounded-[10px]">Metas</TabsTrigger>
            <TabsTrigger value="desafios" className="rounded-[10px]">Desafios</TabsTrigger>
          </TabsList>

          <TabsContent value="grupo" className="mt-4">
            <TabGrupo grupo={grupo} onChange={onChange} onClose={() => onOpenChange(false)} />
          </TabsContent>
          <TabsContent value="membros" className="mt-4">
            <TabMembros grupo={grupo} onChange={onChange} />
          </TabsContent>
          <TabsContent value="metas" className="mt-4">
            <TabMetas grupo={grupo} agregados={agregados} onChange={onChange} />
          </TabsContent>
          <TabsContent value="desafios" className="mt-4">
            <TabDesafios grupo={grupo} onChange={onChange} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// TAB GRUPO
// =====================================================
function TabGrupo({
  grupo,
  onChange,
  onClose,
}: {
  grupo: GrupoFull;
  onChange: () => void;
  onClose: () => void;
}) {
  const [nome, setNome] = useState(grupo.nome);
  const [descricao, setDescricao] = useState(grupo.descricao ?? "");
  const [foto, setFoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [codigo, setCodigo] = useState(grupo.codigo_convite);

  function gerarCodigo() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let s = "";
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return `#RATS-${s}`;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  async function regenerarCodigo() {
    const novo = gerarCodigo();
    const { error } = await supabase.from("grupos").update({ codigo_convite: novo }).eq("id", grupo.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCodigo(novo);
    toast.success("Novo código gerado");
    onChange();
  }

  async function salvar() {
    setSaving(true);
    try {
      let foto_url = grupo.foto_url;
      if (foto) {
        const ext = foto.name.split(".").pop();
        const path = `${grupo.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("grupos-fotos").upload(path, foto, { upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("grupos-fotos").getPublicUrl(path);
        foto_url = pub.publicUrl;
      }
      const { error } = await supabase
        .from("grupos")
        .update({ nome: nome.trim(), descricao: descricao.trim() || null, foto_url })
        .eq("id", grupo.id);
      if (error) throw error;
      toast.success("Grupo atualizado");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function excluir() {
    setSaving(true);
    try {
      // Apaga membros, atividades, desafios, metas e o grupo
      await supabase.from("grupo_membros").delete().eq("grupo_id", grupo.id);
      await supabase.from("grupo_atividades").delete().eq("grupo_id", grupo.id);
      await supabase.from("grupo_desafios").delete().eq("grupo_id", grupo.id);
      await supabase.from("grupo_metas").delete().eq("grupo_id", grupo.id);
      const { error } = await supabase.from("grupos").delete().eq("id", grupo.id);
      if (error) throw error;
      toast.success("Grupo excluído");
      onClose();
      window.location.href = "/grupos";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao excluir");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Label className="text-[12px] text-text-muted">Nome do grupo</Label>
        <Input value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label className="text-[12px] text-text-muted">Descrição</Label>
        <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="mt-1" rows={3} />
      </div>
      <div>
        <Label className="text-[12px] text-text-muted">Foto de capa</Label>
        <Input type="file" accept="image/*" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} className="mt-1" />
      </div>

      <div>
        <Label className="text-[12px] text-text-muted">Código de convite</Label>
        <div className="flex gap-2 mt-1">
          <div className="flex-1 px-3 py-2 rounded-[10px] bg-muted font-mono text-[13px]">{codigo}</div>
          <Button type="button" variant="outline" size="sm" onClick={copiar} className="rounded-[10px]">
            <Copy size={14} />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={regenerarCodigo} className="rounded-[10px]">
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mt-2">
        <Button
          onClick={salvar}
          disabled={saving || !nome.trim()}
          className="flex-1 rounded-[10px] text-white"
          style={{ background: "#1D9E75" }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : "Salvar alterações"}
        </Button>
      </div>

      <div className="border-t border-border pt-4 mt-2">
        {!confirmDelete ? (
          <Button
            variant="outline"
            onClick={() => setConfirmDelete(true)}
            className="w-full rounded-[10px]"
            style={{ borderColor: "#E24B4A", color: "#E24B4A" }}
          >
            <Trash2 size={14} className="mr-1.5" />
            Excluir grupo
          </Button>
        ) : (
          <div className="flex flex-col gap-2 p-3 rounded-[10px]" style={{ background: "#FEE6E5" }}>
            <p className="text-[12px]" style={{ color: "#A0322F" }}>
              Tem certeza? Isso apagará o grupo, todos os membros, metas e desafios. Não dá para desfazer.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={excluir}
                disabled={saving}
                className="flex-1 rounded-[10px] text-white"
                style={{ background: "#E24B4A" }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : "Sim, excluir"}
              </Button>
              <Button variant="outline" onClick={() => setConfirmDelete(false)} className="rounded-[10px]">
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================
// TAB MEMBROS
// =====================================================
function TabMembros({ grupo, onChange }: { grupo: GrupoFull; onChange: () => void }) {
  const [membros, setMembros] = useState<MembroSimples[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: ms } = await supabase
      .from("grupo_membros")
      .select("user_id, role")
      .eq("grupo_id", grupo.id);
    const ids = (ms ?? []).map((m) => m.user_id);
    const safe = ids.length ? ids : ["00000000-0000-0000-0000-000000000000"];
    const [{ data: profs }, { data: xps }] = await Promise.all([
      supabase.from("profiles_public").select("id, display_name, avatar_url").in("id", safe),
      supabase.from("user_xp").select("user_id, xp_total").in("user_id", safe),
    ]);
    const final: MembroSimples[] = (ms ?? []).map((m) => {
      const p = (profs ?? []).find((x) => x.id === m.user_id);
      const xp = Number((xps ?? []).find((x) => x.user_id === m.user_id)?.xp_total ?? 0);
      return {
        user_id: m.user_id,
        role: m.role,
        nome: p?.display_name ?? "Aluno",
        avatar_url: p?.avatar_url ?? null,
        xp_total: xp,
        nivel: calcularNivel(xp),
      };
    });
    final.sort((a, b) => b.xp_total - a.xp_total);
    setMembros(final);
    setLoading(false);
  }, [grupo.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(grupo.codigo_convite);
      toast.success("Código copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  async function remover(userId: string, nome: string) {
    if (!confirm(`Remover ${nome} do grupo?`)) return;
    const { error } = await supabase
      .from("grupo_membros")
      .delete()
      .eq("grupo_id", grupo.id)
      .eq("user_id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${nome} removido`);
    carregar();
    onChange();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="p-3 rounded-[10px] flex items-center justify-between" style={{ background: "#E8F0E5" }}>
        <div>
          <div className="text-[11px] text-text-muted">Código de convite</div>
          <div className="font-mono text-[14px] font-medium">{grupo.codigo_convite}</div>
        </div>
        <Button size="sm" variant="outline" onClick={copiarCodigo} className="rounded-[10px]">
          <Copy size={14} className="mr-1.5" /> Copiar
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-text-muted text-[12px] py-6">Carregando...</div>
      ) : (
        <div className="flex flex-col gap-2">
          {membros.map((m) => {
            const isFundador = m.user_id === grupo.criado_por;
            return (
              <div
                key={m.user_id}
                className="flex items-center gap-3 p-3 rounded-[10px] bg-card border border-border/60"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-medium shrink-0 overflow-hidden"
                  style={{ background: "#E8F0E5" }}
                >
                  {m.avatar_url ? (
                    <img src={m.avatar_url} alt={m.nome} className="w-full h-full object-cover" />
                  ) : (
                    m.nome[0]?.toUpperCase() ?? "?"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium flex items-center gap-1.5">
                    <span className="truncate">{m.nome}</span>
                    {isFundador && <Crown size={12} color="#C9A84C" />}
                  </div>
                  <div className="text-[11px] text-text-muted">{getNivelInfo(m.nivel).nome}</div>
                </div>
                {!isFundador && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => remover(m.user_id, m.nome)}
                    className="rounded-[10px]"
                    style={{ color: "#E24B4A", borderColor: "#E24B4A" }}
                  >
                    <UserMinus size={13} className="mr-1" /> Remover
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================================
// TAB METAS
// =====================================================
function TabMetas({
  grupo,
  agregados,
  onChange,
}: {
  grupo: GrupoFull;
  agregados: { horas_mes: number; questoes_semana: number; topicos_semana: number; streak_grupo: number };
  onChange: () => void;
}) {
  const [metas, setMetas] = useState<MetaCustom[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCriar, setOpenCriar] = useState(false);
  const [editando, setEditando] = useState<MetaCustom | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("grupo_metas")
      .select("*")
      .eq("grupo_id", grupo.id)
      .order("created_at", { ascending: false });
    setMetas((data ?? []) as MetaCustom[]);
    setLoading(false);
  }, [grupo.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Distribui XP automaticamente quando uma meta personalizada for atingida
  useEffect(() => {
    (async () => {
      for (const meta of metas) {
        if (meta.concluida || meta.xp_distribuido) continue;
        let atual = 0;
        if (meta.tipo === "horas") atual = agregados.horas_mes;
        else if (meta.tipo === "questoes") atual = agregados.questoes_semana;
        else if (meta.tipo === "topicos") atual = agregados.topicos_semana;
        else if (meta.tipo === "streak") atual = agregados.streak_grupo;
        if (atual >= meta.valor_alvo) {
          // marca como concluída e distribuída antes de pagar (idempotência)
          const { error } = await supabase
            .from("grupo_metas")
            .update({ concluida: true, xp_distribuido: true, valor_atual: atual })
            .eq("id", meta.id)
            .eq("xp_distribuido", false);
          if (error) continue;

          // Distribui +30 XP a todos os membros
          const { data: ms } = await supabase
            .from("grupo_membros")
            .select("user_id")
            .eq("grupo_id", grupo.id);
          for (const m of ms ?? []) {
            await concederXP(m.user_id, "meta_coletiva");
          }
          await supabase.from("grupo_atividades").insert({
            grupo_id: grupo.id,
            user_id: grupo.criado_por,
            tipo: "meta_concluida",
            descricao: `Meta "${meta.titulo}" foi concluída! +${XP_CONFIG.XP_META_COLETIVA} XP para todos.`,
          });
          toast.success(`Meta "${meta.titulo}" concluída!`);
          onChange();
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metas, agregados.horas_mes, agregados.questoes_semana, agregados.topicos_semana, agregados.streak_grupo]);

  async function excluirMeta(id: string) {
    if (!confirm("Excluir esta meta?")) return;
    const { error } = await supabase.from("grupo_metas").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Meta excluída");
    carregar();
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Metas padrão */}
      <div>
        <h4 className="font-serif text-[14px] mb-2">Metas padrão do sistema</h4>
        <div className="flex flex-col gap-2">
          {METAS_PADRAO_INFO.map((meta) => {
            let atual = 0;
            if (meta.tipo === "horas") atual = agregados.horas_mes;
            if (meta.tipo === "questoes") atual = agregados.questoes_semana;
            if (meta.tipo === "topicos") atual = agregados.topicos_semana;
            if (meta.tipo === "streak") atual = agregados.streak_grupo;
            const pct = Math.min(100, (atual / meta.alvo) * 100);
            const concluida = atual >= meta.alvo;
            return (
              <div key={meta.titulo} className="lei-card p-3">
                <div className="flex justify-between items-center text-[12px] mb-1">
                  <span className="font-medium">{meta.emoji} {meta.titulo}</span>
                  <span className="text-text-muted">{Math.round(atual)}/{meta.alvo} {meta.unidade}</span>
                </div>
                <div style={{ height: 6, background: "#F2EFEA", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: concluida ? "#1D9E75" : "#A6B89A" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Personalizadas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-serif text-[14px]">Metas personalizadas</h4>
          <Button
            size="sm"
            onClick={() => { setEditando(null); setOpenCriar(true); }}
            className="rounded-[10px] text-white"
            style={{ background: "#1D9E75" }}
          >
            <Plus size={13} className="mr-1" /> Nova
          </Button>
        </div>
        {loading ? (
          <div className="text-center text-text-muted text-[12px] py-4">Carregando...</div>
        ) : metas.length === 0 ? (
          <div className="text-center text-text-muted text-[12px] py-4 lei-card">
            Nenhuma meta personalizada criada.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {metas.map((m) => {
              let atual = 0;
              if (m.tipo === "horas") atual = agregados.horas_mes;
              if (m.tipo === "questoes") atual = agregados.questoes_semana;
              if (m.tipo === "topicos") atual = agregados.topicos_semana;
              if (m.tipo === "streak") atual = agregados.streak_grupo;
              const pct = Math.min(100, (atual / m.valor_alvo) * 100);
              return (
                <div key={m.id} className="lei-card p-3">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div className="flex-1">
                      <div className="text-[13px] font-medium">{m.titulo ?? "(sem título)"}</div>
                      <div className="text-[11px] text-text-muted">
                        {m.tipo} · até {new Date(m.fim).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditando(m); setOpenCriar(true); }} className="h-7 w-7 p-0">
                        <Pencil size={13} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => excluirMeta(m.id)} className="h-7 w-7 p-0" style={{ color: "#E24B4A" }}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </div>
                  <div style={{ height: 6, background: "#F2EFEA", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: m.concluida ? "#1D9E75" : "#A6B89A" }} />
                  </div>
                  <div className="flex justify-between mt-1 text-[11px] text-text-muted">
                    <span>{Math.round(atual)} / {m.valor_alvo}</span>
                    <span>{Math.round(pct)}%{m.concluida ? " · concluída" : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MetaPersonalizadaDialog
        open={openCriar}
        onOpenChange={setOpenCriar}
        grupoId={grupo.id}
        meta={editando}
        onSaved={() => { carregar(); onChange(); }}
      />
    </div>
  );
}

function MetaPersonalizadaDialog({
  open,
  onOpenChange,
  grupoId,
  meta,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  grupoId: string;
  meta: MetaCustom | null;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<"horas" | "questoes" | "topicos" | "streak">("horas");
  const [alvo, setAlvo] = useState(10);
  const [fim, setFim] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitulo(meta?.titulo ?? "");
      setTipo((meta?.tipo as "horas" | "questoes" | "topicos" | "streak") ?? "horas");
      setAlvo(meta?.valor_alvo ?? 10);
      setFim(meta ? new Date(meta.fim).toISOString().split("T")[0] : new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]);
    }
  }, [open, meta]);

  async function salvar() {
    if (!titulo.trim()) {
      toast.error("Informe um título");
      return;
    }
    setSaving(true);
    try {
      if (meta) {
        const { error } = await supabase
          .from("grupo_metas")
          .update({
            titulo: titulo.trim(),
            tipo,
            valor_alvo: alvo,
            fim: new Date(fim + "T23:59:59").toISOString(),
          })
          .eq("id", meta.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("grupo_metas").insert({
          grupo_id: grupoId,
          titulo: titulo.trim(),
          tipo,
          valor_alvo: alvo,
          valor_atual: 0,
          fim: new Date(fim + "T23:59:59").toISOString(),
          concluida: false,
        });
        if (error) throw error;
      }
      toast.success(meta ? "Meta atualizada" : "Meta criada");
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[420px] rounded-[14px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[17px]">
            {meta ? "Editar meta" : "Nova meta personalizada"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-2">
          <div>
            <Label className="text-[12px] text-text-muted">Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Tipo</Label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "horas" | "questoes" | "topicos" | "streak")}
              className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="horas">Horas (mês)</option>
              <option value="questoes">Questões (semana)</option>
              <option value="topicos">Tópicos (semana)</option>
              <option value="streak">Streak do grupo (dias)</option>
            </select>
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Valor alvo</Label>
            <Input type="number" min={1} value={alvo} onChange={(e) => setAlvo(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Data limite</Label>
            <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="mt-1" />
          </div>
          <Button onClick={salvar} disabled={saving} className="rounded-[10px] text-white" style={{ background: "#1D9E75" }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// =====================================================
// TAB DESAFIOS
// =====================================================
function TabDesafios({ grupo, onChange }: { grupo: GrupoFull; onChange: () => void }) {
  const [ativos, setAtivos] = useState<DesafioRow[]>([]);
  const [encerrados, setEncerrados] = useState<(DesafioRow & { concluintes: { user_id: string; nome: string }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCriar, setOpenCriar] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data: rows } = await supabase
      .from("grupo_desafios")
      .select("*")
      .eq("grupo_id", grupo.id)
      .order("created_at", { ascending: false });

    const ids = (rows ?? []).map((r) => r.id);
    const { data: concl } = ids.length
      ? await supabase.from("grupo_desafios_membros").select("desafio_id, user_id").in("desafio_id", ids)
      : { data: [] as { desafio_id: string; user_id: string }[] };

    const userIds = Array.from(new Set((concl ?? []).map((c) => c.user_id)));
    const { data: profs } = userIds.length
      ? await supabase.from("profiles_public").select("id, display_name").in("id", userIds)
      : { data: [] as { id: string; display_name: string | null }[] };

    const ativosArr: DesafioRow[] = [];
    const encArr: (DesafioRow & { concluintes: { user_id: string; nome: string }[] })[] = [];
    for (const r of rows ?? []) {
      const lista = (concl ?? []).filter((c) => c.desafio_id === r.id);
      const row: DesafioRow = {
        id: r.id,
        titulo: r.titulo,
        descricao: r.descricao,
        prazo: r.prazo,
        ativo: r.ativo,
        xp_recompensa: r.xp_recompensa,
        total_concluidos: lista.length,
      };
      if (r.ativo && new Date(r.prazo).getTime() > Date.now()) {
        ativosArr.push(row);
      } else {
        encArr.push({
          ...row,
          concluintes: lista.map((l) => ({
            user_id: l.user_id,
            nome: (profs ?? []).find((p) => p.id === l.user_id)?.display_name ?? "Aluno",
          })),
        });
      }
    }
    setAtivos(ativosArr);
    setEncerrados(encArr);
    setLoading(false);
  }, [grupo.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function excluirDesafio(id: string) {
    if (!confirm("Excluir este desafio?")) return;
    await supabase.from("grupo_desafios_membros").delete().eq("desafio_id", id);
    const { error } = await supabase.from("grupo_desafios").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Desafio excluído");
    carregar();
    onChange();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h4 className="font-serif text-[14px]">Desafios ativos</h4>
        <Button
          size="sm"
          onClick={() => setOpenCriar(true)}
          className="rounded-[10px] text-white"
          style={{ background: "#1D9E75" }}
        >
          <Plus size={13} className="mr-1" /> Novo desafio
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-text-muted text-[12px] py-4">Carregando...</div>
      ) : ativos.length === 0 ? (
        <div className="text-center text-text-muted text-[12px] py-4 lei-card">Nenhum desafio ativo.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {ativos.map((d) => (
            <div key={d.id} className="lei-card p-3 flex justify-between items-start gap-2">
              <div className="flex-1">
                <div className="text-[13px] font-medium">{d.titulo}</div>
                {d.descricao && <div className="text-[11px] text-text-muted mt-0.5">{d.descricao}</div>}
                <div className="text-[11px] text-text-muted mt-1">
                  Prazo: {new Date(d.prazo).toLocaleDateString("pt-BR")} · {d.total_concluidos} concluído{d.total_concluidos === 1 ? "" : "s"} · +{d.xp_recompensa} XP
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => excluirDesafio(d.id)} className="h-7 w-7 p-0" style={{ color: "#E24B4A" }}>
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 className="font-serif text-[14px] mb-2">Desafios encerrados</h4>
        {encerrados.length === 0 ? (
          <div className="text-center text-text-muted text-[12px] py-4 lei-card">Nenhum encerrado ainda.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {encerrados.map((d) => (
              <div key={d.id} className="lei-card p-3">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{d.titulo}</div>
                    <div className="text-[11px] text-text-muted">
                      Encerrado em {new Date(d.prazo).toLocaleDateString("pt-BR")}
                    </div>
                    {d.concluintes.length > 0 ? (
                      <div className="text-[11px] mt-1">
                        Concluído por: {d.concluintes.map((c) => c.nome).join(", ")}
                      </div>
                    ) : (
                      <div className="text-[11px] text-text-muted mt-1 italic">Ninguém concluiu</div>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => excluirDesafio(d.id)} className="h-7 w-7 p-0" style={{ color: "#E24B4A" }}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NovoDesafioDialog
        open={openCriar}
        onOpenChange={setOpenCriar}
        grupoId={grupo.id}
        criadoPor={grupo.criado_por}
        onCreated={() => { carregar(); onChange(); }}
      />
    </div>
  );
}

function NovoDesafioDialog({
  open,
  onOpenChange,
  grupoId,
  criadoPor,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  grupoId: string;
  criadoPor: string;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prazo, setPrazo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!titulo.trim()) {
      toast.error("Informe um título");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("grupo_desafios").insert({
        grupo_id: grupoId,
        criado_por: criadoPor,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        prazo: new Date(prazo + "T23:59:59").toISOString(),
        xp_recompensa: XP_CONFIG.XP_DESAFIO_LIDER,
        ativo: true,
      });
      if (error) throw error;
      await supabase.from("grupo_atividades").insert({
        grupo_id: grupoId,
        user_id: criadoPor,
        tipo: "desafio_criado",
        descricao: `criou o desafio "${titulo.trim()}"`,
      });
      toast.success("Desafio criado");
      setTitulo("");
      setDescricao("");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[420px] rounded-[14px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[17px]">Novo desafio semanal</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-2">
          <div>
            <Label className="text-[12px] text-text-muted">Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="mt-1" rows={3} />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Prazo</Label>
            <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="mt-1" />
          </div>
          <div className="text-[11px] text-text-muted px-2 py-1.5 rounded-[8px]" style={{ background: "#E8F0E5" }}>
            🏆 Recompensa fixa: +{XP_CONFIG.XP_DESAFIO_LIDER} XP por membro que concluir
          </div>
          <Button onClick={salvar} disabled={saving} className="rounded-[10px] text-white" style={{ background: "#1D9E75" }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : "Criar desafio"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
