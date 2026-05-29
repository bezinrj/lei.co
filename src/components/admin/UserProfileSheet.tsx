import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, CalendarDays } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Mail,
  Phone,
  Copy,
  Crown,
  Flame,
  Clock,
  BookOpen,
  Target,
  Award,
  Calendar,
  KeyRound,
  Trash2,
  Gift,
  Lock,
  Unlock,
  FileText,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAdminUserProfile,
  toggleUserBloqueado,
  concederCortesia,
  revogarCortesia,
  enviarResetSenha,
  deletarUsuario,
  getAdminUserReport,
  listarAcessosPremium,
  concederCronogramaPremium,
  revogarCronogramaPremium,
  type AdminUserProfile,
  type PremiumAccessItem,
} from "@/server/admin-extra.functions";
import { setUserRole } from "@/server/admin.functions";
import { downloadCSV, downloadPDF } from "@/lib/admin-report";

type Props = {
  userId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged?: () => void;
};

type PlanoTipo = "diamante" | "anual" | "trimestral" | "mensal";

const PLANO_LABEL: Record<PlanoTipo, string> = {
  diamante: "Diamante",
  anual: "Anual",
  trimestral: "Trimestral",
  mensal: "Mensal",
};

export function UserProfileSheet({ userId, open, onOpenChange, onChanged }: Props) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdminUserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportLoading, setReportLoading] = useState<null | "pdf" | "csv">(null);
  const [planoCortesia, setPlanoCortesia] = useState<PlanoTipo>("diamante");
  const [premiumList, setPremiumList] = useState<PremiumAccessItem[]>([]);
  const [premiumBusyId, setPremiumBusyId] = useState<string | null>(null);

  async function load() {
    if (!userId) return;
    setLoading(true);
    try {
      const [p, pl] = await Promise.all([
        getAdminUserProfile({ data: { userId } }),
        listarAcessosPremium({ data: { userId } }),
      ]);
      setProfile(p);
      setPremiumList(pl);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && userId) load();
    else setProfile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  async function withBusy<T>(fn: () => Promise<T>) {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }

  async function handleCortesia(dias: number, tipo: "cortesia" | "teste" = "cortesia") {
    if (!profile) return;
    await withBusy(async () => {
      try {
        await concederCortesia({
          data: { userId: profile.id, dias, tipo, planoTipo: planoCortesia },
        });
        const planoLabel = PLANO_LABEL[planoCortesia];
        toast.success(
          tipo === "teste"
            ? `Teste de 3 dias (${planoLabel}) concedido!`
            : `Cortesia de ${dias} dias (${planoLabel}) concedida!`,
        );
        await load();
        onChanged?.();
      } catch (e: any) {
        toast.error(e?.message ?? "Erro");
      }
    });
  }

  async function handleRevogar() {
    if (!profile) return;
    await withBusy(async () => {
      try {
        await revogarCortesia({ data: { userId: profile.id } });
        toast.success("Benefícios VIP removidos");
        await load();
        onChanged?.();
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao remover");
      }
    });
  }

  async function handleConcederPremium(cronogramaId: string) {
    if (!profile) return;
    setPremiumBusyId(cronogramaId);
    try {
      await concederCronogramaPremium({ data: { userId: profile.id, cronogramaId } });
      toast.success("Cronograma premium concedido!");
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao conceder");
    } finally {
      setPremiumBusyId(null);
    }
  }

  async function handleRevogarPremium(cronogramaId: string) {
    if (!profile) return;
    setPremiumBusyId(cronogramaId);
    try {
      await revogarCronogramaPremium({ data: { userId: profile.id, cronogramaId } });
      toast.success("Cortesia revogada");
      await load();
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao revogar");
    } finally {
      setPremiumBusyId(null);
    }
  }

  async function handleRole(role: "admin" | "moderador" | "user") {
    if (!profile) return;
    await withBusy(async () => {
      try {
        // Limpa roles existentes e seta a nova
        const current = profile.roles as any[];
        for (const r of current) {
          if (r !== role && (r === "admin" || r === "moderador")) {
            await setUserRole({ data: { userId: profile.id, role: r, enabled: false } });
          }
        }
        if (role !== "user") {
          await setUserRole({ data: { userId: profile.id, role, enabled: true } });
        } else {
          // remover admin/moderador (se existirem)
          for (const r of ["admin", "moderador"] as const) {
            if (current.includes(r)) {
              await setUserRole({ data: { userId: profile.id, role: r, enabled: false } });
            }
          }
        }
        toast.success("Role atualizada");
        await load();
        onChanged?.();
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao atualizar role");
      }
    });
  }

  async function handleResetSenha() {
    if (!profile?.email) return toast.error("Usuário sem email");
    await withBusy(async () => {
      try {
        await enviarResetSenha({ data: { email: profile.email! } });
        toast.success("Reset de senha enviado");
      } catch (e: any) {
        toast.error(e?.message ?? "Erro");
      }
    });
  }

  async function handleBloquear() {
    if (!profile) return;
    await withBusy(async () => {
      try {
        await toggleUserBloqueado({
          data: { userId: profile.id, bloqueado: !profile.bloqueado },
        });
        toast.success(profile.bloqueado ? "Usuário desbloqueado" : "Usuário bloqueado");
        await load();
        onChanged?.();
      } catch (e: any) {
        toast.error(e?.message ?? "Erro");
      }
    });
  }

  async function handleDelete() {
    if (!profile) return;
    setConfirmDelete(false);
    await withBusy(async () => {
      try {
        await deletarUsuario({ data: { userId: profile.id } });
        toast.success("Usuário deletado");
        onChanged?.();
        onOpenChange(false);
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao deletar");
      }
    });
  }

  async function handleReport(kind: "pdf" | "csv") {
    if (!profile) return;
    setReportLoading(kind);
    try {
      const report = await getAdminUserReport({ data: { userId: profile.id } });
      if (kind === "pdf") downloadPDF(report);
      else downloadCSV(report);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar relatório");
    } finally {
      setReportLoading(null);
    }
  }

  const initial = profile?.display_name?.[0]?.toUpperCase() ?? "?";
  const isOnline =
    profile?.last_seen && Date.now() - new Date(profile.last_seen).getTime() < 5 * 60_000;
  const role = profile?.roles.includes("admin")
    ? "admin"
    : profile?.roles.includes("moderador")
    ? "moderador"
    : "user";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto bg-background">
        <SheetHeader>
          <SheetTitle className="font-serif text-[18px]">Perfil do aluno</SheetTitle>
        </SheetHeader>

        {loading || !profile ? (
          <div className="py-16 text-center text-text-muted text-[13px]">Carregando...</div>
        ) : (
          <div className="space-y-5 mt-4">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-[60px] h-[60px] rounded-full bg-sage-light flex items-center justify-center text-sage-dark font-serif text-[24px]">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-serif text-[18px] text-text-main truncate">
                  {profile.display_name ?? "Sem nome"}
                </div>
                <div className="text-[12px] text-text-muted">{profile.friend_id ?? "—"}</div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <Badge tone={isOnline ? "sage" : "muted"}>
                    {isOnline ? "🟢 Online" : "⚫ Offline"}
                  </Badge>
                  <PlanBadge plano={profile.plano_atual} />
                  {(profile.plano_atual === "diamante" || profile.plano_atual === "cortesia") && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "#FAEEDA", color: "#412402", border: "1px solid #BA7517" }}>
                      <Crown size={10} /> Diamante
                    </span>
                  )}
                  {profile.bloqueado && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-destructive/10 text-destructive">
                      🚫 Bloqueado
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Exportar relatório completo do aluno */}
            <Button
              size="sm"
              className="w-full gap-2 bg-[#1D9E75] hover:bg-[#188a66] text-white"
              onClick={() => handleReport("pdf")}
              disabled={reportLoading === "pdf"}
            >
              {reportLoading === "pdf" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileText size={14} />
              )}
              {reportLoading === "pdf" ? "Gerando PDF..." : "📄 Exportar Relatório PDF"}
            </Button>

            {/* Contatos */}
            <div className="lei-card p-3 space-y-2">
              <ContactRow
                icon={<Mail size={14} />}
                value={profile.email ?? "—"}
                href={profile.email ? `mailto:${profile.email}` : undefined}
                color="#378ADD"
              />
              <ContactRow
                icon={<Phone size={14} />}
                value={profile.telefone ?? "Não informado"}
                href={profile.telefone ? `tel:${profile.telefone}` : undefined}
                color={profile.telefone ? "#374151" : "#9ca3af"}
              />
              <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono">
                <span title={profile.id}>ID: {profile.id.slice(0, 8)}…</span>
                <button
                  className="hover:text-text-main"
                  title="Copiar ID completo"
                  onClick={() => {
                    navigator.clipboard.writeText(profile.id);
                    toast.success("ID copiado");
                  }}
                >
                  <Copy size={12} />
                </button>
              </div>
            </div>

            {/* Bio */}
            {(profile.bio || profile.concurso_alvo) && (
              <div className="lei-card p-3 space-y-2 text-[13px]">
                {profile.concurso_alvo && (
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-text-muted">Carreira alvo</span>
                    <div className="text-text-main">{profile.concurso_alvo}</div>
                  </div>
                )}
                {profile.bio && (
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-text-muted">Bio</span>
                    <div className="text-text-main">{profile.bio}</div>
                  </div>
                )}
              </div>
            )}

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2">
              <Metric icon={<Flame size={14} />} value={`${profile.metrics.streak}`} label="Streak" tone="blush" />
              <Metric icon={<Clock size={14} />} value={`${profile.metrics.horasEstudadas}h`} label="Horas" tone="sage" />
              <Metric icon={<BookOpen size={14} />} value={`${profile.metrics.questoesFeitas}`} label="Questões" tone="sky" />
              <Metric icon={<Target size={14} />} value={`${profile.metrics.acertosMedio}%`} label="Acerto" tone="lilac" />
              <Metric icon={<Award size={14} />} value={`${profile.metrics.badges}`} label="Badges" tone="sage" />
              <Metric icon={<Calendar size={14} />} value={new Date(profile.created_at).toLocaleDateString("pt-BR", { month: "2-digit", year: "2-digit" })} label="Membro" tone="blush" />
            </div>

            {/* Assinatura */}
            <div className="lei-card p-3 space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">Assinatura</div>
              {profile.assinatura ? (
                <div className="text-[12px] text-text-main">
                  <div className="font-medium">{profile.assinatura.plano_nome ?? profile.plano_atual}</div>
                  <div className="text-text-muted">
                    Status: <span className="font-medium text-text-main">{profile.assinatura.status}</span>
                  </div>
                  <div className="text-text-muted">
                    Início: {new Date(profile.assinatura.inicio).toLocaleDateString("pt-BR")}
                    {profile.assinatura.fim && ` • Fim: ${new Date(profile.assinatura.fim).toLocaleDateString("pt-BR")}`}
                  </div>
                </div>
              ) : (
                <div className="text-[12px] text-text-muted">Sem assinatura ativa</div>
              )}

              <div className="space-y-2 pt-1">
                <label className="text-[11px] text-text-muted">Plano da cortesia</label>
                <Select
                  value={planoCortesia}
                  onValueChange={(v) => setPlanoCortesia(v as PlanoTipo)}
                  disabled={busy}
                >
                  <SelectTrigger className="bg-background h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diamante">Diamante (todos cronogramas)</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <PillButton onClick={() => handleCortesia(30)} disabled={busy} icon={<Gift size={11} />}>
                    30 dias
                  </PillButton>
                  <PillButton onClick={() => handleCortesia(90)} disabled={busy}>
                    90 dias
                  </PillButton>
                  <PillButton onClick={() => handleCortesia(365)} disabled={busy}>
                    365 dias
                  </PillButton>
                  <PillButton onClick={() => handleCortesia(3, "teste")} disabled={busy}>
                    Teste 3 dias
                  </PillButton>
                </div>
                {profile.assinatura &&
                  ["ativa", "cortesia", "teste"].includes(profile.assinatura.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 mt-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={handleRevogar}
                      disabled={busy}
                    >
                      <Trash2 size={14} /> Remover benefícios VIP
                    </Button>
                  )}
              </div>
            </div>

            {/* Cronogramas premium */}
            <div className="lei-card p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">
                Cronogramas premium
              </div>
              {premiumList.length === 0 ? (
                <div className="text-[12px] text-text-muted">Nenhum cronograma premium cadastrado.</div>
              ) : (
                <div className="space-y-1.5">
                  {premiumList.map((p) => {
                    const busyHere = premiumBusyId === p.cronograma_id;
                    return (
                      <div
                        key={p.cronograma_id}
                        className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] text-text-main truncate">{p.nome}</div>
                          <div className="text-[10px] text-text-muted">
                            {p.status === "comprado"
                              ? "Comprado (vitalício)"
                              : p.status === "concedido"
                                ? "Concedido (cortesia)"
                                : "Sem acesso"}
                          </div>
                        </div>
                        {p.status === "sem_acesso" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] gap-1"
                            onClick={() => handleConcederPremium(p.cronograma_id)}
                            disabled={busy || busyHere}
                          >
                            {busyHere ? <Loader2 size={12} className="animate-spin" /> : <Gift size={12} />}
                            Conceder
                          </Button>
                        )}
                        {p.status === "concedido" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px] gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleRevogarPremium(p.cronograma_id)}
                            disabled={busy || busyHere}
                          >
                            {busyHere ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            Revogar
                          </Button>
                        )}
                        {p.status === "comprado" && (
                          <span className="text-[10px] text-text-muted italic">vitalício</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* Relatório */}
            <div className="lei-card p-3 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">Relatório</div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={reportLoading !== null}
                  onClick={() => handleReport("pdf")}
                >
                  {reportLoading === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={reportLoading !== null}
                  onClick={() => handleReport("csv")}
                >
                  {reportLoading === "csv" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                  CSV
                </Button>
              </div>
            </div>

            {/* Ações */}
            <div className="lei-card p-3 space-y-3">
              <div className="text-[11px] uppercase tracking-wider text-text-muted">Ações</div>

              <div>
                <label className="text-[12px] text-text-muted">Alterar role</label>
                <Select value={role} onValueChange={(v) => handleRole(v as any)} disabled={busy}>
                  <SelectTrigger className="mt-1 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Aluno</SelectItem>
                    <SelectItem value="moderador">Moderador</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleBloquear}
                  disabled={busy}
                >
                  {profile.bloqueado ? <Unlock size={14} /> : <Lock size={14} />}
                  {profile.bloqueado ? "Desbloquear" : "Bloquear"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={handleResetSenha}
                  disabled={busy}
                >
                  <KeyRound size={14} /> Reset de senha
                </Button>
              </div>

              <Button
                size="sm"
                variant="destructive"
                className="w-full gap-2"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                <Trash2 size={14} /> Deletar conta do usuário
              </Button>
            </div>
          </div>
        )}
      </SheetContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todos os dados do usuário serão apagados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}

function ContactRow({
  icon,
  value,
  href,
  color,
}: {
  icon: React.ReactNode;
  value: string;
  href?: string;
  color?: string;
}) {
  const content = (
    <span className="inline-flex items-center gap-2 text-[13px]" style={{ color }}>
      {icon} {value}
    </span>
  );
  return href ? (
    <a href={href} className="block hover:underline">
      {content}
    </a>
  ) : (
    <div>{content}</div>
  );
}

function Metric({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  tone: "sage" | "blush" | "sky" | "lilac";
}) {
  const bg = {
    sage: "var(--sage-light)",
    blush: "var(--blush-light)",
    sky: "var(--sky-light)",
    lilac: "var(--lilac-light)",
  }[tone];
  return (
    <div className="lei-card p-3 text-center">
      <div className="w-7 h-7 rounded-full mx-auto flex items-center justify-center mb-1" style={{ background: bg }}>
        {icon}
      </div>
      <div className="font-serif text-[16px] text-text-main leading-tight">{value}</div>
      <div className="text-[10px] text-text-muted uppercase tracking-wider">{label}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "sage" | "muted" }) {
  const styles = {
    sage: "bg-sage-light text-sage-dark",
    muted: "bg-muted text-text-muted",
  }[tone];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${styles}`}>
      {children}
    </span>
  );
}

function PlanBadge({ plano }: { plano: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    gratuito: { bg: "var(--cream)", color: "var(--text-muted)", label: "Gratuito" },
    mensal: { bg: "var(--sage-light)", color: "var(--sage-dark)", label: "Mensal" },
    trimestral: { bg: "var(--sage-light)", color: "var(--sage-dark)", label: "Trimestral" },
    anual: { bg: "var(--sage-light)", color: "var(--sage-dark)", label: "Anual" },
    diamante: { bg: "#FAEEDA", color: "#412402", label: "Diamante" },
    cortesia: { bg: "var(--blush-light)", color: "#8B3A3A", label: "Cortesia" },
  };
  const s = map[plano] ?? map.gratuito;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function PillButton({
  children,
  onClick,
  disabled,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sage-light text-sage-dark text-[11px] font-medium hover:bg-sage hover:text-white transition disabled:opacity-50"
    >
      {icon}
      {children}
    </button>
  );
}
