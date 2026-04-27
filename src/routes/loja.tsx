import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, Plus, Star, Flame, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/loja")({
  head: () => ({ meta: [{ title: "Loja — Lei.co" }] }),
  component: LojaPage,
});

type Categoria = "cronograma" | "ebook" | "material" | "mentoria" | "outro";

type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: Categoria | null;
  preco_centavos: number | null;
  preco_original_centavos: number | null;
  link_externo: string;
  imagem_url: string | null;
  badges: string[];
  desconto_pct: number | null;
  destaque: boolean;
  ativo: boolean;
  ordem: number;
};

const FILTROS: { id: "todos" | Categoria; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "cronograma", label: "Cronogramas" },
  { id: "material", label: "Materiais" },
  { id: "ebook", label: "Ebooks" },
  { id: "mentoria", label: "Mentorias" },
  { id: "outro", label: "Outros" },
];

const CAT_LABEL: Record<Categoria, string> = {
  cronograma: "Cronograma",
  ebook: "Ebook",
  material: "Material",
  mentoria: "Mentoria",
  outro: "Outro",
};

const BADGES_DISPONIVEIS: { key: string; label: string }[] = [
  { key: "destaque", label: "⭐ Destaque" },
  { key: "mais_vendido", label: "🔥 Mais vendido" },
  { key: "novo", label: "🆕 Novo" },
  { key: "em_breve", label: "📌 Em breve" },
];

function formatBRL(centavos: number | null | undefined) {
  if (centavos == null) return "";
  return `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;
}

function emojiCategoria(cat: Categoria | null): string {
  const map: Record<string, string> = {
    cronograma: "📚",
    ebook: "📖",
    material: "📝",
    mentoria: "🎯",
    outro: "📋",
  };
  return (cat && map[cat]) || "📦";
}

function corFundoCategoria(cat: Categoria | null): string {
  const map: Record<string, string> = {
    cronograma: "#E1F5EE",
    ebook: "#EDE9F5",
    material: "#E6F1FB",
    mentoria: "#FAEEDA",
    outro: "#F1EFE8",
  };
  return (cat && map[cat]) || "#F1EFE8";
}

function LojaPage() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin");

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<"todos" | Categoria>("todos");
  const [editing, setEditing] = useState<Produto | null>(null);
  const [openForm, setOpenForm] = useState(false);

  async function carregar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("loja_produtos")
      .select("*")
      .order("destaque", { ascending: false })
      .order("ordem", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Erro ao carregar produtos");
    } else {
      setProdutos((data ?? []) as Produto[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  const destaque = useMemo(
    () => produtos.find((p) => p.destaque && p.ativo) ?? null,
    [produtos],
  );

  const lista = useMemo(() => {
    let arr = produtos.filter((p) => (isAdmin ? true : p.ativo));
    if (destaque) arr = arr.filter((p) => p.id !== destaque.id);
    if (filtro !== "todos") arr = arr.filter((p) => p.categoria === filtro);
    return arr;
  }, [produtos, filtro, destaque, isAdmin]);

  function abrirNovo() {
    setEditing(null);
    setOpenForm(true);
  }

  function abrirEdicao(p: Produto) {
    setEditing(p);
    setOpenForm(true);
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("loja_produtos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Produto excluído");
    carregar();
  }

  return (
    <AppShell title="Loja">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="font-serif text-[17px] text-text-main leading-tight">Loja</h1>
          <p className="text-[12px] text-text-muted mt-0.5">
            Produtos e materiais para sua jornada
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={abrirNovo}
            className="inline-flex items-center gap-1.5 text-[12px] text-white font-medium rounded-full px-[18px] py-2 transition-opacity hover:opacity-90"
            style={{ background: "#1D9E75" }}
          >
            <Plus size={14} /> Adicionar produto
          </button>
        )}
      </div>

      {/* Filtros pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        {FILTROS.map((f) => {
          const ativa = filtro === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className="text-[12px] rounded-full px-3 py-1.5 transition-colors"
              style={
                ativa
                  ? {
                      background: "#E8F0E5",
                      color: "#7A9A70",
                      border: "1px solid #B8C9B0",
                    }
                  : {
                      background: "#fff",
                      color: "#6b7280",
                      border: "1px solid #e5e7eb",
                    }
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="lei-card text-center py-12 text-text-muted text-[13px]">
          Carregando produtos...
        </div>
      )}

      {/* Empty */}
      {!loading && produtos.length === 0 && (
        <div className="lei-card text-center py-16">
          <div className="text-4xl mb-2">🛍️</div>
          <div className="font-serif text-[18px] mb-1">Loja vazia</div>
          <p className="text-text-muted text-[13px]">
            {isAdmin
              ? "Adicione o primeiro produto clicando no botão acima."
              : "Em breve novos produtos por aqui."}
          </p>
        </div>
      )}

      {/* Destaque */}
      {!loading && destaque && (filtro === "todos" || destaque.categoria === filtro) && (
        <ProdutoDestaque
          produto={destaque}
          isAdmin={isAdmin}
          onEdit={() => abrirEdicao(destaque)}
          onDelete={() => excluir(destaque.id)}
        />
      )}

      {/* Grid */}
      {!loading && (lista.length > 0 || isAdmin) && (
        <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((p) => (
            <ProdutoCard
              key={p.id}
              produto={p}
              isAdmin={isAdmin}
              onEdit={() => abrirEdicao(p)}
              onDelete={() => excluir(p.id)}
            />
          ))}
          {isAdmin && <AdicionarProdutoCard onClick={abrirNovo} />}
        </div>
      )}

      {!loading && lista.length === 0 && produtos.length > 0 && !destaque && !isAdmin && (
        <div className="lei-card text-center py-12 text-text-muted text-[13px]">
          Nenhum produto nesta categoria.
        </div>
      )}

      {/* Form admin */}
      {isAdmin && (
        <ProdutoForm
          open={openForm}
          onOpenChange={setOpenForm}
          produto={editing}
          onSaved={() => {
            setOpenForm(false);
            carregar();
          }}
        />
      )}
    </AppShell>
  );
}

/* ---------- Cards ---------- */

function BadgesRow({ produto }: { produto: Produto }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {produto.badges?.includes("destaque") && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10px] font-semibold"
          style={{ background: "#FAEEDA", color: "#412402" }}
        >
          <Star size={10} fill="#412402" /> Destaque
        </span>
      )}
      {produto.badges?.includes("mais_vendido") && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10px] font-semibold"
          style={{ background: "#FAECE7", color: "#4A1B0C" }}
        >
          <Flame size={10} /> Mais vendido
        </span>
      )}
      {produto.desconto_pct ? (
        <span
          className="rounded-full px-2.5 py-[3px] text-[10px] font-semibold"
          style={{ background: "#E24B4A", color: "#fff" }}
        >
          -{produto.desconto_pct}%
        </span>
      ) : null}
      {produto.categoria && (
        <span
          className="rounded-full px-2.5 py-[3px] text-[10px] font-medium"
          style={{ background: "#E8F0E5", color: "#7A9A70" }}
        >
          {CAT_LABEL[produto.categoria]}
        </span>
      )}
      {!produto.ativo && (
        <span className="rounded-full px-2.5 py-[3px] text-[10px] font-medium bg-muted text-text-muted">
          Inativo
        </span>
      )}
    </div>
  );
}

function AdminButtons({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="absolute top-2 right-2 flex gap-1 z-10">
      <button
        onClick={onEdit}
        aria-label="Editar"
        className="w-7 h-7 rounded-lg bg-white/90 border border-border flex items-center justify-center hover:bg-white transition"
      >
        <Pencil size={12} className="text-text-main" />
      </button>
      <button
        onClick={onDelete}
        aria-label="Excluir"
        className="w-7 h-7 rounded-lg bg-white/90 border border-red-200 flex items-center justify-center hover:bg-white transition"
      >
        <Trash2 size={12} style={{ color: "#E24B4A" }} />
      </button>
    </div>
  );
}

function ProdutoDestaque({
  produto,
  isAdmin,
  onEdit,
  onDelete,
}: {
  produto: Produto;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="relative bg-card overflow-hidden mb-4 flex flex-col md:flex-row"
      style={{
        borderRadius: 16,
        border: "1px solid rgba(61,56,48,0.1)",
        minHeight: 200,
      }}
    >
      <div
        className="w-full md:w-[280px] md:min-w-[280px] h-[180px] md:h-auto flex items-center justify-center text-5xl"
        style={{
          background: produto.imagem_url
            ? `url(${produto.imagem_url}) center/cover`
            : "linear-gradient(135deg, #1D9E75, #085041)",
          color: "#fff",
        }}
      >
        {!produto.imagem_url && emojiCategoria(produto.categoria)}
      </div>

      <div className="flex-1 p-6 flex flex-col justify-between">
        <div>
          <div className="mb-2.5">
            <BadgesRow produto={produto} />
          </div>
          <div className="font-serif text-[20px] font-medium text-text-main mb-1.5">
            {produto.nome}
          </div>
          {produto.descricao && (
            <div className="text-[12px] text-text-muted leading-relaxed mb-3 line-clamp-3">
              {produto.descricao}
            </div>
          )}
          <div className="flex items-center gap-2.5">
            {produto.preco_original_centavos ? (
              <span className="text-[12px] text-gray-400 line-through">
                {formatBRL(produto.preco_original_centavos)}
              </span>
            ) : null}
            {produto.preco_centavos != null && (
              <span
                className="font-serif text-[22px] font-medium"
                style={{ color: "#1D9E75" }}
              >
                {formatBRL(produto.preco_centavos)}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-end mt-3">
          <a
            href={produto.link_externo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-white text-[12px] font-medium rounded-full px-6 py-2.5 hover:opacity-90 transition"
            style={{ background: "#1D9E75" }}
          >
            Comprar agora <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {isAdmin && <AdminButtons onEdit={onEdit} onDelete={onDelete} />}
    </div>
  );
}

function ProdutoCard({
  produto,
  isAdmin,
  onEdit,
  onDelete,
}: {
  produto: Produto;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="relative bg-card flex flex-col overflow-hidden"
      style={{ borderRadius: 14, border: "1px solid rgba(61,56,48,0.1)" }}
    >
      <div
        className="h-[140px] flex items-center justify-center text-4xl"
        style={{
          background: produto.imagem_url
            ? `url(${produto.imagem_url}) center/cover`
            : "linear-gradient(135deg, #B8C9B0, #7A9A70)",
          color: "#fff",
        }}
      >
        {!produto.imagem_url && emojiCategoria(produto.categoria)}
      </div>

      {isAdmin && <AdminButtons onEdit={onEdit} onDelete={onDelete} />}

      <div className="p-4 flex flex-col flex-1">
        <div className="mb-2">
          <BadgesRow produto={produto} />
        </div>
        <div className="font-serif text-[15px] font-medium text-text-main mb-1 line-clamp-2">
          {produto.nome}
        </div>
        {produto.descricao && (
          <div className="text-[11px] text-text-muted leading-relaxed mb-3 line-clamp-2">
            {produto.descricao}
          </div>
        )}

        <div className="mt-auto">
          {produto.preco_centavos != null && (
            <div className="flex items-center gap-2 mb-3">
              {produto.preco_original_centavos ? (
                <span className="text-[11px] text-gray-400 line-through">
                  {formatBRL(produto.preco_original_centavos)}
                </span>
              ) : null}
              <span
                className="font-serif text-[18px] font-medium"
                style={{ color: "#1D9E75" }}
              >
                {formatBRL(produto.preco_centavos)}
              </span>
            </div>
          )}

          <a
            href={produto.link_externo}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-1.5 text-white text-[12px] font-medium rounded-full px-4 py-2 hover:opacity-90 transition"
            style={{ background: "#1D9E75" }}
          >
            Comprar <ExternalLink size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}

/* ---------- Form (admin) ---------- */

function ProdutoForm({
  open,
  onOpenChange,
  produto,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  produto: Produto | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("cronograma");
  const [linkExterno, setLinkExterno] = useState("");
  const [imagemUrl, setImagemUrl] = useState("");
  const [precoReais, setPrecoReais] = useState("");
  const [precoOriginalReais, setPrecoOriginalReais] = useState("");
  const [descontoPct, setDescontoPct] = useState("");
  const [badgeDestaque, setBadgeDestaque] = useState(false);
  const [badgeMaisVendido, setBadgeMaisVendido] = useState(false);
  const [destaque, setDestaque] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [ordem, setOrdem] = useState("0");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (produto) {
      setNome(produto.nome);
      setDescricao(produto.descricao ?? "");
      setCategoria((produto.categoria ?? "outro") as Categoria);
      setLinkExterno(produto.link_externo);
      setImagemUrl(produto.imagem_url ?? "");
      setPrecoReais(
        produto.preco_centavos != null ? (produto.preco_centavos / 100).toString() : "",
      );
      setPrecoOriginalReais(
        produto.preco_original_centavos != null
          ? (produto.preco_original_centavos / 100).toString()
          : "",
      );
      setDescontoPct(produto.desconto_pct?.toString() ?? "");
      setBadgeDestaque(produto.badges?.includes("destaque") ?? false);
      setBadgeMaisVendido(produto.badges?.includes("mais_vendido") ?? false);
      setDestaque(produto.destaque);
      setAtivo(produto.ativo);
      setOrdem(produto.ordem?.toString() ?? "0");
    } else {
      setNome("");
      setDescricao("");
      setCategoria("cronograma");
      setLinkExterno("");
      setImagemUrl("");
      setPrecoReais("");
      setPrecoOriginalReais("");
      setDescontoPct("");
      setBadgeDestaque(false);
      setBadgeMaisVendido(false);
      setDestaque(false);
      setAtivo(true);
      setOrdem("0");
    }
  }, [open, produto]);

  async function salvar() {
    if (!nome.trim() || !linkExterno.trim()) {
      toast.error("Nome e link são obrigatórios");
      return;
    }
    setSaving(true);
    const badges: string[] = [];
    if (badgeDestaque) badges.push("destaque");
    if (badgeMaisVendido) badges.push("mais_vendido");

    const payload = {
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      categoria,
      link_externo: linkExterno.trim(),
      imagem_url: imagemUrl.trim() || null,
      preco_centavos: precoReais ? Math.round(parseFloat(precoReais) * 100) : null,
      preco_original_centavos: precoOriginalReais
        ? Math.round(parseFloat(precoOriginalReais) * 100)
        : null,
      desconto_pct: descontoPct ? parseInt(descontoPct, 10) : null,
      badges,
      destaque,
      ativo,
      ordem: parseInt(ordem, 10) || 0,
    };

    const { error } = produto
      ? await supabase.from("loja_produtos").update(payload).eq("id", produto.id)
      : await supabase.from("loja_produtos").insert(payload);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(produto ? "Produto atualizado" : "Produto criado");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {produto ? "Editar produto" : "Novo produto"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <Label className="text-[12px]">Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div>
            <Label className="text-[12px]">Descrição</Label>
            <Textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[12px]">Categoria</Label>
              <Select
                value={categoria}
                onValueChange={(v) => setCategoria(v as Categoria)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cronograma">Cronograma</SelectItem>
                  <SelectItem value="material">Material</SelectItem>
                  <SelectItem value="ebook">Ebook</SelectItem>
                  <SelectItem value="mentoria">Mentoria</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px]">Ordem</Label>
              <Input
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label className="text-[12px]">Link externo *</Label>
            <Input
              placeholder="https://..."
              value={linkExterno}
              onChange={(e) => setLinkExterno(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-[12px]">Imagem (URL)</Label>
            <Input
              placeholder="https://..."
              value={imagemUrl}
              onChange={(e) => setImagemUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[12px]">Preço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={precoReais}
                onChange={(e) => setPrecoReais(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[12px]">Preço original (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={precoOriginalReais}
                onChange={(e) => setPrecoOriginalReais(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-[12px]">Desconto (%)</Label>
              <Input
                type="number"
                value={descontoPct}
                onChange={(e) => setDescontoPct(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={badgeDestaque}
                onChange={(e) => setBadgeDestaque(e.target.checked)}
              />
              Badge ⭐ Destaque
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={badgeMaisVendido}
                onChange={(e) => setBadgeMaisVendido(e.target.checked)}
              />
              Badge 🔥 Mais vendido
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={destaque}
                onChange={(e) => setDestaque(e.target.checked)}
              />
              Banner em destaque (topo da página)
            </label>
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
              />
              Ativo
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={salvar}
            disabled={saving}
            style={{ background: "#1D9E75" }}
            className="text-white hover:opacity-90"
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
