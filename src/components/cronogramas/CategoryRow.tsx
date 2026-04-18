import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CronogramaCard } from "./CronogramaCard";

type Cronograma = {
  id: string;
  nome: string;
  categoria: string | null;
  imagem_url: string | null;
  premium: boolean;
};

type Props = {
  title: string;
  items: Cronograma[];
  onSelect: (id: string) => void;
  isLocked?: (c: Cronograma) => boolean;
};

export function CategoryRow({ title, items, onSelect, isLocked }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -360 : 360, behavior: "smooth" });
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[16px] font-medium text-text-main">{title}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => scroll("left")}
            aria-label="Anterior"
            className="w-8 h-8 rounded-full text-text-muted hover:text-text-main hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll("right")}
            aria-label="Próximo"
            className="w-8 h-8 rounded-full text-text-muted hover:text-text-main hover:bg-muted flex items-center justify-center transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((c) => (
          <CronogramaCard
            key={c.id}
            nome={c.nome}
            imagem_url={c.imagem_url}
            premium={c.premium}
            locked={isLocked?.(c) ?? false}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </div>
    </section>
  );
}
