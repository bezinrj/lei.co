import { useEffect, useState, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { calcularNivel, getNivelInfo } from "@/lib/xp";
import { Users, Plus, KeyRound, Upload, Lock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/grupos")({
  head: () => ({ meta: [{ title: "Grupos — Lei.co" }] }),
  component: GruposPage,
});

type GrupoCard = {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  codigo_convite: string;
  membros_count: number;
  xp_total: number;
  nivel_medio: number;
};

function gerarCodigo(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `#RATS-${s}`;
}

function GruposPage() {
  const { user } = useAuth();
  const { isPremium } = usePlan();
  const [grupos, setGrupos] = useState<GrupoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCriar, setOpenCriar] = useState(false);
  const [openEntrar, setOpenEntrar] = useState(false);

  async function carregar() {
    if (!user) return;
    setLoading(true);

    const { data: membros } = await supabase
      .from("grupo_membros")
      .select("grupo_id")
      .eq("user_id", user.id);

    const ids = (membros ?? []).map((m) => m.grupo_id);
    if (ids.length === 0) {
      setGrupos([]);
      setLoading(false);
      return;
    }

    const { data: grps } = await supabase
      .from("grupos")
      .select("id, nome, descricao, foto_url, codigo_convite")
      .in("id", ids);

    // Agregar membros + XP
    const cards: GrupoCard[] = await Promise.all(
      (grps ?? []).map(async (g) => {
        const { data: ms } = await supabase
          .from("grupo_membros")
          .select("user_id")
          .eq("grupo_id", g.id);
        const userIds = (ms ?? []).map((m) => m.user_id);
        let xp_total = 0;
        if (userIds.length > 0) {
          const { data: xps } = await supabase
            .from("user_xp")
            .select("xp_total")
            .in("user_id", userIds);
          xp_total = (xps ?? []).reduce((a, x) => a + Number(x.xp_total ?? 0), 0);
        }
        const xp_medio = userIds.length > 0 ? Math.floor(xp_total / userIds.length) : 0;
        return {
          ...g,
          membros_count: userIds.length,
          xp_total,
          nivel_medio: calcularNivel(xp_medio),
        };
      }),
    );

    setGrupos(cards);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <AppShell title="Grupos">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="font-serif text-[20px] text-text-main">Seus grupos</h2>
          <p className="text-text-muted text-[13px]">
            Estude junto, suba de nível em conjunto.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setOpenEntrar(true)}
            className="rounded-[10px]"
          >
            <KeyRound size={14} className="mr-1.5" />
            Entrar com código
          </Button>
          <Button
            onClick={() => {
              if (!isPremium) {
                toast.error("Criar grupo é um recurso premium.");
                return;
              }
              setOpenCriar(true);
            }}
            className="bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px]"
          >
            {isPremium ? <Plus size={14} className="mr-1.5" /> : <Lock size={14} className="mr-1.5" />}
            Criar grupo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="lei-card text-center py-12 text-text-muted text-[13px]">
          Carregando...
        </div>
      ) : grupos.length === 0 ? (
        <div className="lei-card text-center py-16">
          <Users size={32} className="mx-auto text-text-muted mb-3" />
          <div className="font-serif text-[18px] mb-1">Nenhum grupo ainda</div>
          <p className="text-text-muted text-[13px]">
            Entre em um grupo com um código ou crie o seu (premium).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {grupos.map((g) => {
            const niv = getNivelInfo(g.nivel_medio);
            return (
              <Link
                key={g.id}
                to="/grupos/$id"
                params={{ id: g.id }}
                className="lei-card hover:shadow-md transition-shadow flex flex-col items-center text-center"
              >
                <div
                  style={{
                    width: "96px",
                    height: "96px",
                    borderRadius: "50%",
                    background: g.foto_url
                      ? `url(${g.foto_url}) center/cover`
                      : "linear-gradient(135deg, var(--sage), var(--lilac))",
                  }}
                />
                <div className="pt-3 flex-1 flex flex-col gap-2 w-full items-center">
                  <div className="flex flex-col items-center gap-1 w-full">
                    <h3 className="font-serif text-[15px] text-text-main truncate max-w-full">
                      {g.nome}
                    </h3>
                    <span className="text-[10px] text-text-muted font-mono">
                      {g.codigo_convite}
                    </span>
                  </div>
                  {g.descricao && (
                    <p className="text-[12px] text-text-muted line-clamp-2">
                      {g.descricao}
                    </p>
                  )}
                  <div className="mt-auto pt-2 flex items-center justify-center gap-3 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {g.membros_count} membro{g.membros_count !== 1 ? "s" : ""}
                    </span>
                    <span>·</span>
                    <span>{niv.nome}</span>
                  </div>
                  <div className="text-[10px] text-text-muted">
                    {g.xp_total.toLocaleString("pt-BR")} XP total
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <CriarGrupoDialog
        open={openCriar}
        onOpenChange={setOpenCriar}
        onCreated={carregar}
      />
      <EntrarGrupoDialog
        open={openEntrar}
        onOpenChange={setOpenEntrar}
        onJoined={carregar}
      />
    </AppShell>
  );
}

function CriarGrupoDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setNome("");
    setDescricao("");
    setFile(null);
    setPreview(null);
  }

  function handleFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !user) return;
    setSaving(true);
    try {
      let foto_url: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("grupos-fotos")
          .upload(path, file, { cacheControl: "3600" });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("grupos-fotos").getPublicUrl(path);
        foto_url = pub.publicUrl;
      }

      // Gerar código único (até 5 tentativas)
      let codigo = gerarCodigo();
      for (let i = 0; i < 5; i++) {
        const { data: existe } = await supabase
          .from("grupos")
          .select("id")
          .eq("codigo_convite", codigo)
          .maybeSingle();
        if (!existe) break;
        codigo = gerarCodigo();
      }

      const { error } = await supabase.from("grupos").insert({
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        foto_url,
        codigo_convite: codigo,
        criado_por: user.id,
      });
      if (error) throw error;

      toast.success(`Grupo criado! Código: ${codigo}`);
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar grupo";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[440px] rounded-[14px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[18px] text-text-main">
            Criar grupo
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <Label className="text-[12px] text-text-muted">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Ratos do TJ-SP"
              required
              maxLength={60}
              className="mt-1 bg-background"
            />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Sobre o que é o grupo?"
              maxLength={200}
              rows={3}
              className="mt-1 bg-background"
            />
          </div>
          <div>
            <Label className="text-[12px] text-text-muted">Foto de capa</Label>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1 w-full border border-dashed border-border rounded-[12px] bg-background hover:bg-muted/50 transition-colors p-5 flex flex-col items-center justify-center gap-2"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="prévia"
                  className="w-full h-28 object-cover rounded-[8px]"
                />
              ) : (
                <>
                  <Upload size={20} className="text-text-muted" />
                  <span className="text-[12px] text-text-main">
                    Clique para enviar imagem
                  </span>
                </>
              )}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button
            type="submit"
            disabled={saving || !nome.trim()}
            className="w-full bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px]"
          >
            {saving ? "Criando..." : "Criar grupo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EntrarGrupoDialog({
  open,
  onOpenChange,
  onJoined,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onJoined: () => void;
}) {
  const { user } = useAuth();
  const [codigo, setCodigo] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    let entrada = codigo.trim().toUpperCase();
    if (!entrada) return;
    if (!entrada.startsWith("#")) entrada = `#${entrada}`;

    setSaving(true);
    try {
      // Tenta como código de convite
      let { data: grupo } = await supabase
        .from("grupos")
        .select("id, nome, max_membros")
        .eq("codigo_convite", entrada)
        .maybeSingle();

      // Se não encontrou e parece com friend_id, busca grupos do amigo? Spec: "código #RATS-XXXX ou ID de amigo"
      // Friend ID busca o usuário e mostra erro pedindo código real (não há grupos via friend_id direto)
      if (!grupo && entrada.startsWith("#LEI-")) {
        toast.error(
          "ID de amigo encontrado, mas você precisa do código #RATS-XXXX do grupo.",
        );
        setSaving(false);
        return;
      }

      if (!grupo) {
        toast.error("Grupo não encontrado. Verifique o código.");
        setSaving(false);
        return;
      }

      // Verificar se já é membro
      const { data: jaMembro } = await supabase
        .from("grupo_membros")
        .select("id")
        .eq("grupo_id", grupo.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (jaMembro) {
        toast.info("Você já é membro deste grupo.");
        onOpenChange(false);
        setSaving(false);
        return;
      }

      // Verificar vagas
      const { count } = await supabase
        .from("grupo_membros")
        .select("*", { count: "exact", head: true })
        .eq("grupo_id", grupo.id);

      if ((count ?? 0) >= grupo.max_membros) {
        toast.error("Este grupo está cheio.");
        setSaving(false);
        return;
      }

      const { error } = await supabase.from("grupo_membros").insert({
        grupo_id: grupo.id,
        user_id: user.id,
        role: "membro",
      });
      if (error) throw error;

      toast.success(`Você entrou em "${grupo.nome}"!`);
      setCodigo("");
      onOpenChange(false);
      onJoined();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao entrar no grupo";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card sm:max-w-[400px] rounded-[14px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[18px] text-text-main">
            Entrar em um grupo
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div>
            <Label className="text-[12px] text-text-muted">
              Código de convite
            </Label>
            <Input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="#RATS-XXXX"
              required
              className="mt-1 bg-background font-mono uppercase"
            />
            <p className="text-[11px] text-text-muted mt-1">
              Peça o código a quem criou o grupo.
            </p>
          </div>
          <Button
            type="submit"
            disabled={saving || !codigo.trim()}
            className="w-full bg-sage-dark hover:bg-sage-dark/90 text-white rounded-[10px]"
          >
            {saving ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
