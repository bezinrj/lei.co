import { Link, useLocation } from "@tanstack/react-router";
import { User, CalendarDays, Award, Users } from "lucide-react";

const items = [
  { to: "/perfil", label: "Meu Perfil", icon: User },
  { to: "/cronogramas", label: "Cronograma", icon: CalendarDays },
  { to: "/medalhas", label: "Medalhas", icon: Award },
  { to: "/grupos", label: "Grupos", icon: Users },
];

export function BottomTabBar() {
  const location = useLocation();
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active =
            location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                className={`flex flex-col items-center justify-center gap-1 py-2 text-[10px] transition-colors ${
                  active ? "text-sage-dark font-medium" : "text-text-muted hover:text-text-main"
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
