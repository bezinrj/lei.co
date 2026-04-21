import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CronogramaCard } from "./CronogramaCard";

type CronogramaBase = {
  id: string;
  nome: string;
  categoria: string | null;
  imagem_url: string | null;
  premium: boolean;
  is_proprio?: boolean;
};

type Props<T extends CronogramaBase> = {
  title: string;
  items: T[];
  onSelect: (id: string) => void;
  isLocked?: (c: T) => boolean;
  showActions?: boolean;
  onEdit?: (c: T) => void;
  onDuplicate?: (c: T) => void;
  onDelete?: (c: T) => void;
};

export function CategoryRow<T extends CronogramaBase>({
  title,
  items,
  onSelect,
  isLocked,
  showActions,
  onEdit,
  onDuplicate,
  onDelete,
}: Props<T>) {
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
            isProprio={c.is_proprio}
            locked={isLocked?.(c) ?? false}
            showActions={showActions}
            onClick={() => onSelect(c.id)}
            onEdit={onEdit ? () => onEdit(c) : undefined}
            onDuplicate={onDuplicate ? () => onDuplicate(c) : undefined}
            onDelete={onDelete ? () => onDelete(c) : undefined}
          />
        ))}
      </div>
    </section>
  );
}
