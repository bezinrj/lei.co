import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/cronograma/$id")({
  head: () => ({ meta: [{ title: "Cronograma — Lei.co" }] }),
  component: CronogramaDetail,
});

function CronogramaDetail() {
  const { id } = Route.useParams();
  const [data, setData] = useState<{
    nome: string;
    categoria: string | null;
    imagem_url: string | null;
    premium: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("cronogramas")
      .select("nome, categoria, imagem_url, premium")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setData(data);
        setLoading(false);
      });
  }, [id]);

  return (
    <AppShell title={data?.nome ?? "Cronograma"}>
      <Link
        to="/cronogramas"
        className="inline-flex items-center gap-1 text-[13px] text-text-muted hover:text-text-main mb-4"
      >
        <ArrowLeft size={14} /> Voltar
      </Link>
      {loading ? (
        <div className="lei-card text-center py-16 text-text-muted text-[13px]">Carregando...</div>
      ) : !data ? (
        <div className="lei-card text-center py-16">
          <div className="font-serif text-[18px]">Cronograma não encontrado</div>
        </div>
      ) : (
        <div className="lei-card flex gap-6 items-start">
          {data.imagem_url && (
            <img
              src={data.imagem_url}
              alt={data.nome}
              className="w-[180px] h-[240px] object-cover rounded-[12px] border border-border"
            />
          )}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-text-muted mb-1">
              {data.categoria ?? "Sem categoria"}
            </div>
            <h1 className="font-serif text-[24px] text-text-main mb-2">{data.nome}</h1>
            <span
              className="inline-block text-[10px] font-medium rounded-[20px] px-2 py-[2px]"
              style={
                data.premium
                  ? { background: "#FAC775", color: "#633806" }
                  : { background: "var(--color-sage-light)", color: "var(--color-sage-dark)" }
              }
            >
              {data.premium ? "Premium" : "Gratuito"}
            </span>
            <p className="text-[13px] text-text-muted mt-4">
              O conteúdo detalhado do cronograma aparecerá aqui na próxima iteração.
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
