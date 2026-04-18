type TopbarProps = {
  title: string;
  userName?: string;
  initials?: string;
};

export function Topbar({ title, userName = "Maria", initials = "MA" }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between px-8 py-4">
        <h1 className="font-serif text-[17px] text-text-main">{title}</h1>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-text-muted">Olá, {userName}</span>
          <div className="w-9 h-9 rounded-full bg-sage-light text-sage-dark flex items-center justify-center text-[12px] font-medium">
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
