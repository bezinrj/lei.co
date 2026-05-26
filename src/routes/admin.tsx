import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { listAdminUsers, type AdminUser } from "@/server/admin.functions";
import {
  getAdminDashMetrics,
  type AdminDashMetrics,
} from "@/server/admin-extra.functions";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Search,
  Users as UsersIcon,
  BookMarked,
  GraduationCap,
  Zap,
  Ban,
  CreditCard,
  Gift,
  Eye,
  Trash2,
  Copy,
  Crown,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { CronogramasAdminTab } from "@/components/admin/CronogramasAdminTab";
import { AlunosAdminTab } from "@/components/admin/AlunosAdminTab";
import { UserProfileSheet } from "@/components/admin/UserProfileSheet";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Painel Admin — Lei.co" }] }),
  component: AdminPage,
});

type Filter = "todos" | "novos" | "ativos";

function AdminPage() {
  const { roles, loading, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [metrics, setMetrics] = useState<AdminDashMetrics | null>(null);
  const [fetching, setFetching] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isAdmin = roles.includes("admin");

  const load = useCallback(async () => {
    try {
      const [u, m] = await Promise.all([listAdminUsers(), getAdminDashMetrics()]);
      setUsers(u?.users ?? []);
      setMetrics(m);
    } catch (e) {
      console.error("admin load failed", e);
      toast.error("Erro ao carregar dados");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!isAdmin) {
      navigate({ to: "/perfil" });
      return;
    }
    load();
  }, [loading, isAdmin, user, load, navigate]);

  // Realtime: profiles changes (last_seen, novo cadastro, bloqueado)
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-profiles-watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "assinaturas" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, load]);

  // Debounce busca
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Atalho: UUID completo abre direto o perfil
  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (isUuid && users.some((u) => u.id === trimmed)) {
      setSelectedUserId(trimmed);
      setSheetOpen(true);
    }
  }, [debouncedQuery, users]);

  const filteredUsers = useMemo(() => {
    const now = Date.now();
    return users.filter((u) => {
      if (filter === "novos") {
        const created = new Date(u.created_at).getTime();
        if (now - created > 7 * 24 * 60 * 60 * 1000) return false;
      }
      if (filter === "ativos") {
        if (!u.last_seen_at) return false;
        if (now - new Date(u.last_seen_at).getTime() > 24 * 60 * 60 * 1000) return false;
      }
      if (debouncedQuery.trim()) {
        const q = debouncedQuery.toLowerCase();
        return (
          u.email?.toLowerCase().includes(q) ||
          u.display_name?.toLowerCase().includes(q) ||
          u.friend_id?.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, filter, debouncedQuery]);

  const onlineUsers = useMemo(() => users.filter((u) => u.online).slice(0, 8), [users]);

  if (loading || (!isAdmin && fetching)) {
    return (
      <AppShell title="Painel Admin">
        <div className="lei-card text-center py-16 text-text-muted text-[13px]">Carregando...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Painel Admin">
      <div className="mb-6">
        <h1 className="font-serif text-[26px] text-text-main flex items-center gap-2">
          <Shield size={22} /> Painel Admin
        </h1>
        <p className="text-[13px] text-text-muted mt-1">Visão geral, usuários e gestão de conta</p>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList className="bg-muted">
          <TabsTrigger value="usuarios" className="gap-2">
            <UsersIcon size={14} /> Usuários
          </TabsTrigger>
          <TabsTrigger value="cronogramas" className="gap-2">
            <BookMarked size={14} /> Cronogramas
          </TabsTrigger>
          <TabsTrigger value="alunos" className="gap-2">
            <GraduationCap size={14} /> Alunos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-6">
          {/* Métricas 3x2 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <MetricCard tone="sage" icon={<UsersIcon size={16} />} label="Total de usuários" value={metrics?.totalUsers ?? 0} />
            <MetricCard tone="green" icon="🟢" label="Online agora" value={metrics?.online ?? 0} />
            <MetricCard tone="sky" icon={<Zap size={16} />} label="Ativos 24h" value={metrics?.ativos24h ?? 0} />
            <MetricCard tone="blush" icon={<Ban size={16} />} label="Bloqueados" value={metrics?.bloqueados ?? 0} />
            <MetricCard tone="lilac" icon={<CreditCard size={16} />} label="Assinaturas ativas" value={metrics?.assinaturasAtivas ?? 0} />
            <MetricCard tone="sage" icon={<Gift size={16} />} label="Cortesias ativas" value={metrics?.cortesiasAtivas ?? 0} />
          </div>

          {/* Online agora */}
          <div className="lei-card mb-6 p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[12px] uppercase tracking-wider text-text-muted">Usuários online agora</span>
            </div>
            {onlineUsers.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-[12px]">Ninguém online no momento</div>
            ) : (
              <div className="divide-y divide-border/60">
                {onlineUsers.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={u.display_name ?? u.email ?? "?"} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-text-main font-medium truncate">{u.display_name ?? "—"}</div>
                      <div className="text-[11px] text-text-muted truncate">{u.email}</div>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {u.last_seen_at ? formatRelative(u.last_seen_at) : "agora"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Busca + filtros */}
          <div className="lei-card p-0 overflow-hidden">
            <div className="p-4 border-b border-border space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nome, email ou ID do aluno"
                  className="pl-9 bg-background"
                />
              </div>
              <div className="flex gap-1.5">
                <FilterPill active={filter === "todos"} onClick={() => setFilter("todos")}>
                  Todos
                </FilterPill>
                <FilterPill active={filter === "novos"} onClick={() => setFilter("novos")}>
                  Novos (7d)
                </FilterPill>
                <FilterPill active={filter === "ativos"} onClick={() => setFilter("ativos")}>
                  Ativos (24h)
                </FilterPill>
              </div>
            </div>

            {/* Lista de cards */}
            <div className="divide-y divide-border/60">
              {fetching ? (
                <div className="text-center py-10 text-text-muted">Carregando...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-10 text-text-muted">Nenhum usuário encontrado</div>
              ) : (
                filteredUsers.slice(0, 100).map((u) => (
                  <UserRow key={u.id} user={u} />
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cronogramas" className="mt-4">
          <CronogramasAdminTab />
        </TabsContent>

        <TabsContent value="alunos" className="mt-4">
          <AlunosAdminTab />
        </TabsContent>
      </Tabs>

      <UserProfileSheet
        userId={selectedUserId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onChanged={load}
      />
    </AppShell>
  );
}

// ====== Subcomponents ======

function MetricCard({
  tone,
  icon,
  label,
  value,
}: {
  tone: "sage" | "green" | "sky" | "blush" | "lilac";
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  const bg = {
    sage: "var(--sage-light)",
    green: "#dcfce7",
    sky: "var(--sky-light)",
    blush: "var(--blush-light)",
    lilac: "var(--lilac-light)",
  }[tone];
  const fg = {
    sage: "var(--sage-dark)",
    green: "#16a34a",
    sky: "#0369a1",
    blush: "#9f1239",
    lilac: "#6d28d9",
  }[tone];
  return (
    <div className="lei-card flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-[16px]"
        style={{ background: bg, color: fg }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-serif text-[28px] text-text-main leading-none">{value}</div>
        <div className="text-[11px] text-text-muted uppercase tracking-wider mt-1">{label}</div>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  const colors = ["bg-sage-light text-sage-dark", "bg-blush-light text-blush", "bg-sky-light text-sky", "bg-lilac-light text-lilac"];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-[13px] ${colors[idx]}`}>
      {initial}
    </div>
  );
}

function FilterPill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition ${
        active
          ? "bg-sage-dark text-white"
          : "bg-muted text-text-muted hover:bg-sage-light hover:text-sage-dark"
      }`}
    >
      {children}
    </button>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const isOnline = user.online;
  const role = user.roles.includes("admin")
    ? { label: "Administrador", bg: "var(--lilac-light)", color: "#6d28d9" }
    : user.roles.includes("moderador")
    ? { label: "Moderador", bg: "var(--sky-light)", color: "#0369a1" }
    : { label: "Aluno", bg: "var(--sage-light)", color: "var(--sage-dark)" };
  const planoMap: Record<string, { bg: string; color: string; label: string; icon?: string }> = {
    free: { bg: "var(--cream)", color: "var(--text-muted)", label: "Gratuito" },
    premium: { bg: "var(--sage-light)", color: "var(--sage-dark)", label: "Premium" },
    diamante: { bg: "#FAEEDA", color: "#412402", label: "Diamante", icon: "👑" },
    cortesia: { bg: "var(--blush-light)", color: "#8B3A3A", label: "Cortesia" },
  };
  const plano = planoMap[user.plano ?? "free"] ?? planoMap.free;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition">
      <Avatar name={user.display_name ?? user.email ?? "?"} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-text-main truncate">
            {user.display_name ?? "—"}
          </span>
          <span className="text-[11px] text-text-muted">{user.friend_id ?? ""}</span>
          <Pill bg={role.bg} color={role.color}>
            {role.label}
          </Pill>
          <Pill bg={plano.bg} color={plano.color}>
            {plano.icon && <span className="mr-0.5">{plano.icon}</span>}
            {plano.label}
          </Pill>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {user.email && (
            <a href={`mailto:${user.email}`} className="text-[11px] inline-flex items-center gap-1" style={{ color: "#378ADD" }}>
              <Mail size={10} />
              {user.email}
            </a>
          )}
          <span className="text-[11px] text-text-muted">
            {user.telefone ?? "Não informado"}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-gray-400"}`} />
            {isOnline ? "Ativo" : user.last_seen_at ? `Visto ${formatRelative(user.last_seen_at)}` : "Inativo"}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-muted">
            {user.id.slice(0, 4)}...{user.id.slice(-4)}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(user.id);
                toast.success("ID copiado");
              }}
              className="hover:text-text-main"
            >
              <Copy size={10} />
            </button>
          </span>
        </div>
      </div>
      <a
        href={`/admin/aluno/${user.id}`}
        onClick={(e) => {
          e.preventDefault();
          window.location.assign(`/admin/aluno/${user.id}`);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sage-light text-sage-dark text-[11px] font-medium hover:bg-sage hover:text-white transition"
      >
        <Eye size={12} />
        Ver perfil
      </a>
    </div>
  );
}

function Pill({ children, bg, color }: { children: React.ReactNode; bg: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: bg, color }}
    >
      {children}
    </span>
  );
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}
