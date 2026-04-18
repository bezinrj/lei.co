import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { listAdminUsers, setUserRole, type AdminUser } from "@/server/admin.functions";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Shield, Search, Users as UsersIcon, Circle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Painel Admin — Lei.co" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { roles, loading, user, session } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [query, setQuery] = useState("");

  const isAdmin = roles.includes("admin");

  const load = useCallback(async () => {
    try {
      const token = session?.access_token;
      if (!token) throw new Error("no-session");
      const res = await listAdminUsers({
        data: { accessToken: token },
      });
      setUsers(res?.users ?? []);
    } catch (e) {
      console.error("listAdminUsers failed", e);
      toast.error("Erro ao carregar usuários");
      setUsers([]);
    } finally {
      setFetching(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!isAdmin) {
      navigate({ to: "/dashboard" });
      return;
    }
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [loading, isAdmin, user, load, navigate]);

  async function toggleRole(u: AdminUser, role: "admin" | "moderador", enabled: boolean) {
    const prev = users;
    setUsers((curr) =>
      curr.map((x) =>
        x.id === u.id
          ? { ...x, roles: enabled ? [...new Set([...x.roles, role])] : x.roles.filter((r) => r !== role) }
          : x,
      ),
    );
    try {
      const token = session?.access_token;
      if (!token) throw new Error("no-session");
      await setUserRole({
        data: { accessToken: token, userId: u.id, role, enabled },
      });
      toast.success("Permissão atualizada");
    } catch {
      setUsers(prev);
      toast.error("Falha ao atualizar permissão");
    }
  }

  const filtered = users.filter((u) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.friend_id?.toLowerCase().includes(q)
    );
  });

  const onlineCount = users.filter((u) => u.online).length;

  if (loading || (!isAdmin && fetching)) {
    return (
      <AppShell title="Painel Admin">
        <div className="lei-card text-center py-16 text-text-muted text-[13px]">Carregando...</div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Painel Admin">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-[26px] text-text-main flex items-center gap-2">
            <Shield size={22} /> Painel Admin
          </h1>
          <p className="text-[13px] text-text-muted mt-1">
            Controle de usuários, presença e permissões
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total de usuários" value={users.length} icon={<UsersIcon size={16} />} />
        <StatCard
          label="Online agora"
          value={onlineCount}
          icon={<Circle size={10} className="fill-emerald-500 text-emerald-500" />}
        />
        <StatCard
          label="Admins/Mods"
          value={users.filter((u) => u.roles.some((r) => r === "admin" || r === "moderador")).length}
          icon={<Shield size={16} />}
        />
      </div>

      <div className="lei-card p-0 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <div className="relative w-full max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, email ou Friend ID"
              className="pl-9 bg-background"
            />
          </div>
          <button
            onClick={load}
            className="text-[12px] text-text-muted hover:text-text-main"
          >
            Atualizar
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted/50 text-text-muted text-[11px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Usuário</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Cadastro</th>
                <th className="text-left px-4 py-3">Último login</th>
                <th className="text-center px-4 py-3">Admin</th>
                <th className="text-center px-4 py-3">Moderador</th>
              </tr>
            </thead>
            <tbody>
              {fetching ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-text-muted">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-text-muted">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="text-text-main font-medium">{u.display_name ?? "—"}</div>
                      <div className="text-text-muted text-[11px]">{u.email}</div>
                      {u.friend_id && (
                        <div className="font-mono text-[10px] text-text-muted mt-0.5">{u.friend_id}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.online ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700">
                          <Circle size={8} className="fill-emerald-500 text-emerald-500" />
                          Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-text-muted">
                          <Circle size={8} className="fill-muted-foreground/40 text-muted-foreground/40" />
                          {u.last_seen_at ? formatRelative(u.last_seen_at) : "Nunca"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3 text-text-muted">
                      {u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={u.roles.includes("admin")}
                        onCheckedChange={(v) => toggleRole(u, "admin", v)}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Switch
                        checked={u.roles.includes("moderador")}
                        onCheckedChange={(v) => toggleRole(u, "moderador", v)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="lei-card flex items-center justify-between">
      <div>
        <div className="text-[11px] uppercase tracking-wider text-text-muted">{label}</div>
        <div className="font-serif text-[24px] text-text-main mt-1">{value}</div>
      </div>
      <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-text-muted">
        {icon}
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}
