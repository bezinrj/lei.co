import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Star, Flame, ExternalLink, ImageIcon, Loader2, X } from "lucide-react";
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
  const queryClient = useQueryClient();

  const [filtro, setFiltro] = useState<"todos" | Categoria>("todos");
  const [editing, setEditing] = useState<Produto | null>(null);
  const [openForm, setOpenForm] = useState(false);

  const { data: produtos = [], isLoading: loading } = useQuery({
    queryKey: ["loja"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loja_produtos")
        .select("*")
        .order("destaque", { ascending: false })
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Erro ao carregar produtos");
        throw error;
      }
      return (data ?? []) as Produto[];
    },
  });

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

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loja_produtos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loja"] });
      toast.success("Produto excluído");
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  function excluir(id: string) {
    if (!confirm("Excluir este produto?")) return;
    excluirMutation.mutate(id);
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
            queryClient.invalidateQueries({ queryKey: ["loja"] });
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
      className="relative bg-card flex flex-col overflow-hidden transition-transform hover:-translate-y-0.5"
      style={{ borderRadius: 14, border: "1px solid rgba(61,56,48,0.1)" }}
    >
      {/* Imagem com badges sobrepostos */}
      <div
        className="relative h-[140px] flex items-center justify-center text-[36px]"
        style={{
          background: produto.imagem_url
            ? `url(${produto.imagem_url}) center/cover`
            : corFundoCategoria(produto.categoria),
        }}
      >
        {!produto.imagem_url && <span>{emojiCategoria(produto.categoria)}</span>}

        {/* Badges overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {produto.badges?.includes("novo") && (
            <span
              className="rounded-full px-1.5 py-[2px] text-[9px] font-semibold"
              style={{ background: "#EDE9F5", color: "#26215C" }}
            >
              🆕 Novo
            </span>
          )}
          {produto.badges?.includes("mais_vendido") && (
            <span
              className="rounded-full px-1.5 py-[2px] text-[9px] font-semibold"
              style={{ background: "#FAECE7", color: "#4A1B0C" }}
            >
              🔥 Top
            </span>
          )}
          {produto.badges?.includes("em_breve") && (
            <span
              className="rounded-full px-1.5 py-[2px] text-[9px] font-semibold"
              style={{ background: "#E6F1FB", color: "#042C53" }}
            >
              📌 Em breve
            </span>
          )}
          {produto.badges?.includes("destaque") && (
            <span
              className="rounded-full px-1.5 py-[2px] text-[9px] font-semibold"
              style={{ background: "#FAEEDA", color: "#412402" }}
            >
              ⭐ Destaque
            </span>
          )}
          {produto.desconto_pct ? (
            <span
              className="rounded-full px-1.5 py-[2px] text-[9px] font-semibold"
              style={{ background: "#E24B4A", color: "#fff" }}
            >
              -{produto.desconto_pct}%
            </span>
          ) : null}
          {!produto.ativo && (
            <span className="rounded-full px-1.5 py-[2px] text-[9px] font-semibold bg-muted text-text-muted">
              Inativo
            </span>
          )}
        </div>

        {isAdmin && <AdminButtons onEdit={onEdit} onDelete={onDelete} />}
      </div>

      {/* Corpo */}
      <div className="p-3 flex flex-col flex-1">
        {produto.categoria && (
          <div
            className="text-[10px] uppercase tracking-wider mb-1"
            style={{ color: "#8A8478" }}
          >
            {CAT_LABEL[produto.categoria]}
          </div>
        )}
        <div className="text-[13px] font-medium text-text-main mb-1 leading-snug line-clamp-2">
          {produto.nome}
        </div>
        {produto.descricao && (
          <div className="text-[11px] text-text-muted leading-relaxed mb-2.5 line-clamp-2">
            {produto.descricao}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1">
            {produto.preco_original_centavos ? (
              <span className="text-[10px] text-gray-400 line-through">
                {formatBRL(produto.preco_original_centavos)}
              </span>
            ) : null}
            {produto.preco_centavos != null && (
              <span
                className="font-serif text-[16px] font-medium"
                style={{ color: produto.desconto_pct ? "#1D9E75" : "#111827" }}
              >
                {formatBRL(produto.preco_centavos)}
              </span>
            )}
          </div>
          <a
            href={produto.link_externo}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-full px-3 py-[5px] text-[11px] hover:opacity-90 transition"
            style={{
              background: "#F7F4EE",
              color: "#374151",
              border: "1px solid #e5e7eb",
            }}
          >
            Ver →
          </a>
        </div>
      </div>
    </div>
  );
}

function AdicionarProdutoCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 min-h-[220px] rounded-[14px] border-2 border-dashed transition-colors"
      style={{ borderColor: "#e5e7eb", color: "#8A8478", background: "transparent" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#B8C9B0";
        e.currentTarget.style.color = "#7A9A70";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e5e7eb";
        e.currentTarget.style.color = "#8A8478";
      }}
    >
      <Plus size={24} />
      <div className="text-[12px] font-medium">Adicionar produto</div>
    </button>
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
  const [badges, setBadges] = useState<string[]>([]);
  const [destaque, setDestaque] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [ordem, setOrdem] = useState("0");
  const queryClient = useQueryClient();

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
      setBadges(produto.badges ?? []);
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
      setBadges([]);
      setDestaque(false);
      setAtivo(true);
      setOrdem("0");
    }
  }, [open, produto]);

  function toggleBadge(key: string) {
    setBadges((prev) =>
      prev.includes(key) ? prev.filter((b) => b !== key) : [...prev, key],
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        categoria,
        link_externo: linkExterno.trim(),
        imagem_url: imagemUrl.trim() || null,
        preco_centavos: precoReais
          ? Math.round(parseFloat(precoReais.replace(",", ".")) * 100)
          : null,
        preco_original_centavos: precoOriginalReais
          ? Math.round(parseFloat(precoOriginalReais.replace(",", ".")) * 100)
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
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loja"] });
      toast.success(produto ? "Produto atualizado" : "Produto criado");
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar produto"),
  });

  function salvar() {
    if (!nome.trim() || !linkExterno.trim()) {
      toast.error("Nome e link são obrigatórios");
      return;
    }
    saveMutation.mutate();
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

          <ImagemUploader value={imagemUrl} onChange={setImagemUrl} />

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

          <div className="pt-2">
            <Label className="text-[12px] mb-1.5 block">Badges</Label>
            <div className="flex gap-1.5 flex-wrap">
              {BADGES_DISPONIVEIS.map((b) => {
                const ativa = badges.includes(b.key);
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => toggleBadge(b.key)}
                    className="rounded-full px-2.5 py-1 text-[10px] transition-colors"
                    style={{
                      border: ativa ? "1px solid #B8C9B0" : "1px solid #e5e7eb",
                      background: ativa ? "#E8F0E5" : "#fff",
                      color: ativa ? "#7A9A70" : "#6b7280",
                    }}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
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
            disabled={saveMutation.isPending}
            style={{ background: "#1D9E75" }}
            className="text-white hover:opacity-90"
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImagemUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    const tiposPermitidos = ["image/jpeg", "image/png", "image/webp"];
    if (!tiposPermitidos.includes(file.type)) {
      toast.error("Formato inválido. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const fileName = `produto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("loja-imagens")
        .upload(fileName, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("loja-imagens").getPublicUrl(fileName);
      onChange(data.publicUrl);
      toast.success("Imagem enviada!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar imagem.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <Label className="text-[12px] mb-1.5 block">Imagem de capa</Label>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = "#B8C9B0";
        }}
        onDragLeave={(e) => {
          e.currentTarget.style.borderColor = "#e5e7eb";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.borderColor = "#e5e7eb";
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className="group relative flex h-[140px] cursor-pointer items-center justify-center overflow-hidden rounded-[10px] border-2 border-dashed transition-colors"
        style={{
          borderColor: "#e5e7eb",
          background: value ? `url(${value}) center/cover` : "#fafafa",
        }}
      >
        {!value && !uploading && (
          <div className="text-center text-[#8A8478]">
            <ImageIcon className="mx-auto mb-1.5 h-6 w-6" />
            <div className="text-[11px] font-medium">
              Clique ou arraste a imagem aqui
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              JPG, PNG ou WebP · Máx 5MB
            </div>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            <span className="text-[11px]">Enviando...</span>
          </div>
        )}
        {value && !uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-[11px] font-medium text-white">
              Clique para trocar
            </span>
          </div>
        )}
      </div>
      {value && !uploading && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#E24B4A] hover:underline"
        >
          <X className="h-3 w-3" /> Remover imagem
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
