import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, CalendarDays, Award, Users, Trophy, LogOut, LogIn, Shield } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/hooks/useAuth";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
};

const principal: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cronogramas", label: "Cronograma", icon: CalendarDays },
  { to: "/medalhas", label: "Medalhas", icon: Award },
];

const comunidade: NavItem[] = [
  { to: "/grupos", label: "Grupos", icon: Users },
  { to: "/ranking", label: "Ranking Global", icon: Trophy },
];

const admin: NavItem[] = [{ to: "/admin", label: "Painel Admin", icon: Shield }];

function NavSection({ title, items }: { title: string; items: NavItem[] }) {
  const location = useLocation();
  return (
    <div className="mb-6">
      <div className="px-3 mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-text-muted">
        {title}
      </div>
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2 rounded-[10px] text-[13px] transition-colors ${
                active
                  ? "bg-sage-light text-sage-dark font-medium"
                  : "text-text-main hover:bg-muted"
              }`}
            >
              <Icon size={16} className={active ? "text-sage-dark" : "text-text-muted"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppSidebar() {
  const { user, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const friendId = "#LEI-4821";
  const isAdmin = roles.includes("admin");

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-[220px] flex-col bg-card border-r border-border px-4 py-6 z-30">
      <div className="px-2 mb-8">
        <Logo size={26} showTagline />
      </div>

      <div className="flex-1 overflow-y-auto">
        <NavSection title="Principal" items={principal} />
        <NavSection title="Comunidade" items={comunidade} />
        {isAdmin && <NavSection title="Admin" items={admin} />}
      </div>

      <div className="rounded-[12px] bg-lilac-light border border-border px-3 py-3 mb-3">
        <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
          Seu Friend ID
        </div>
        <div className="font-mono text-[13px] text-text-main font-medium">{friendId}</div>
      </div>

      {user ? (
        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] text-text-muted hover:bg-muted hover:text-text-main transition-colors"
        >
          <LogOut size={14} /> Sair
        </button>
      ) : (
        <Link
          to="/auth"
          className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] text-text-muted hover:bg-muted hover:text-text-main transition-colors"
        >
          <LogIn size={14} /> Entrar
        </Link>
      )}
    </aside>
  );
}
