import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { WeeklyPerformance } from "@/components/dashboard/WeeklyPerformance";
import { TodaySchedule } from "@/components/dashboard/TodaySchedule";
import { GroupRanking } from "@/components/dashboard/GroupRanking";
import { SubjectPerformance } from "@/components/dashboard/SubjectPerformance";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pencil, Camera, Copy, Check, Lock, Star, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { maskPhoneBR } from "@/lib/phone-mask";

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  friend_id: string;
  bio: string | null;
  concurso_alvo: string | null;
  data_prova: string | null;
  telefone: string | null;
  created_at: string;
};

type Badge = {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  ordem: number;
};

type UserBadge = {
  id: string;
  badge_id: string;
  publica: boolean;
  destaque: boolean;
};

type Stats = {
  horasTotais: number;
  sequenciaAtual: number;
  maiorSequencia: number;
  totalQuestoes: number;
  mediaAcerto: number;
  cronogramasAtivos: number;
};

export const Route = createFileRoute("/perfil")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — Lei.co" },
      { name: "description", content: "Personalize seu perfil, badges e meta de estudos no Lei.co." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: PerfilPage,
});

const corMap: Record<string, { bg: string; ring: string }> = {
  sage: { bg: "var(--sage-light)", ring: "var(--sage-dark)" },
  blush: { bg: "var(--blush-light)", ring: "var(--blush)" },
  lilac: { bg: "var(--lilac-light)", ring: "var(--lilac)" },
  sky: { bg: "var(--sky-light)", ring: "var(--sky)" },
};

function PerfilPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [stats, setStats] = useState<Stats>({
    horasTotais: 0,
    sequenciaAtual: 0,
    maiorSequencia: 0,
    totalQuestoes: 0,
    mediaAcerto: 0,
    cronogramasAtivos: 0,
  });
  const [loading, setLoading] = useState(true);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [bioValue, setBioValue] = useState("");
  const [concursoValue, setConcursoValue] = useState("");
  const [dataProvaValue, setDataProvaValue] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    (async () => {
      const [
        profileRes,
        badgesRes,
        userBadgesRes,
        ativacaoRes,
        eventosRes,
        sessoesRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("badges").select("*").order("ordem"),
        supabase.from("user_badges").select("*").eq("user_id", user.id),
        supabase
          .from("user_cronograma_ativacao")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("ativo", true),
        supabase
          .from("user_calendar_events")
          .select("data, concluido")
          .eq("user_id", user.id)
          .eq("concluido", true)
          .order("data", { ascending: true }),
        supabase
          .from("user_sessions")
          .select("tempo_estudado, questoes, acertos")
          .eq("user_id", user.id),
      ]);

      if (!mounted) return;

      if (profileRes.data) {
        const p = profileRes.data as Profile;
        setProfile(p);
        setNameValue(p.display_name ?? "");
        setBioValue(p.bio ?? "");
        setConcursoValue(p.concurso_alvo ?? "");
        setDataProvaValue(p.data_prova ?? "");
        setPhoneValue(p.telefone ?? "");
      }

      setBadges((badgesRes.data ?? []) as Badge[]);
      setUserBadges((userBadgesRes.data ?? []) as UserBadge[]);

      // Horas / questões / % acerto a partir de user_sessions
      const sessoes = sessoesRes.data ?? [];
      const horasTotais = sessoes.reduce((acc, s) => {
        const [h, m] = (s.tempo_estudado ?? "0:0").split(":");
        return acc + (parseInt(h, 10) || 0) + (parseInt(m, 10) || 0) / 60;
      }, 0);
      const totalQuestoes = sessoes.reduce((acc, s) => acc + (s.questoes ?? 0), 0);
      const totalAcertos = sessoes.reduce((acc, s) => acc + (s.acertos ?? 0), 0);
      const mediaAcerto =
        totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;

      // Sequências (maior + atual) de dias consecutivos com evento concluído
      const datas = Array.from(
        new Set((eventosRes.data ?? []).map((e) => e.data)),
      ).sort();
      let maior = 0;
      let atual = 0;
      let prev: Date | null = null;
      for (const d of datas) {
        const cur = new Date(d);
        if (prev) {
          const diff = (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
          atual = diff === 1 ? atual + 1 : 1;
        } else {
          atual = 1;
        }
        if (atual > maior) maior = atual;
        prev = cur;
      }
      // sequência "atual" só vale se a última data for hoje ou ontem
      let sequenciaAtual = 0;
      if (prev) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const last = new Date(prev);
        last.setHours(0, 0, 0, 0);
        const diffDias = Math.round((hoje.getTime() - last.getTime()) / 86400000);
        if (diffDias <= 1) sequenciaAtual = atual;
      }

      setStats({
        horasTotais: Math.round(horasTotais * 10) / 10,
        sequenciaAtual,
        maiorSequencia: maior,
        totalQuestoes,
        mediaAcerto,
        cronogramasAtivos: ativacaoRes.count ?? 0,
      });

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [user]);

  const userBadgeMap = useMemo(() => {
    const m = new Map<string, UserBadge>();
    userBadges.forEach((ub) => m.set(ub.badge_id, ub));
    return m;
  }, [userBadges]);

  const destaqueBadge = useMemo(() => {
    const ub = userBadges.find((u) => u.destaque);
    if (!ub) return null;
    return badges.find((b) => b.id === ub.badge_id) ?? null;
  }, [userBadges, badges]);

  async function saveProfile(patch: Partial<Profile>) {
    if (!user) return;
    const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
    if (error) {
      toast.error("Não foi possível salvar.");
      return false;
    }
    setProfile((p) => (p ? { ...p, ...patch } : p));
    return true;
  }

  async function handleSaveName() {
    if (!nameValue.trim()) {
      toast.error("Nome não pode ser vazio.");
      return;
    }
    if (await saveProfile({ display_name: nameValue.trim() })) {
      setEditingName(false);
      toast.success("Nome atualizado.");
    }
  }

  async function handleSaveBio(value: string) {
    if (value === (profile?.bio ?? "")) return;
    await saveProfile({ bio: value || null });
  }

  async function handleSaveMeta() {
    if (
      concursoValue === (profile?.concurso_alvo ?? "") &&
      dataProvaValue === (profile?.data_prova ?? "")
    ) {
      return;
    }
    if (
      await saveProfile({
        concurso_alvo: concursoValue || null,
        data_prova: dataProvaValue || null,
      })
    ) {
      toast.success("Meta atualizada.");
    }
  }

  async function handleSavePhone() {
    const trimmed = phoneValue.trim();
    if (trimmed === (profile?.telefone ?? "")) {
      setEditingPhone(false);
      return;
    }
    if (await saveProfile({ telefone: trimmed || null } as Partial<Profile>)) {
      setEditingPhone(false);
      toast.success("Telefone atualizado.");
    }
  }

  async function handleAvatarUpload(file: File) {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter até 2MB.");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await saveProfile({ avatar_url: data.publicUrl });
      toast.success("Avatar atualizado.");
    } catch (e) {
      toast.error("Falha ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  }

  async function copyFriendId() {
    if (!profile) return;
    await navigator.clipboard.writeText(profile.friend_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function toggleBadgePublic(badgeId: string, value: boolean) {
    const ub = userBadgeMap.get(badgeId);
    if (!ub || !user) return;
    const { error } = await supabase
      .from("user_badges")
      .update({ publica: value })
      .eq("id", ub.id);
    if (error) {
      toast.error("Não foi possível atualizar.");
      return;
    }
    setUserBadges((prev) =>
      prev.map((u) => (u.id === ub.id ? { ...u, publica: value } : u)),
    );
  }

  async function setDestaque(badgeId: string) {
    const ub = userBadgeMap.get(badgeId);
    if (!ub || !user) return;
    const novoValor = !ub.destaque;
    const { error } = await supabase
      .from("user_badges")
      .update({ destaque: novoValor })
      .eq("id", ub.id);
    if (error) {
      toast.error("Não foi possível definir destaque.");
      return;
    }
    setUserBadges((prev) =>
      prev.map((u) => ({
        ...u,
        destaque: u.id === ub.id ? novoValor : novoValor ? false : u.destaque,
      })),
    );
    if (novoValor) toast.success("Badge em destaque atualizada.");
  }

  if (loading || !profile) {
    return (
      <AppShell title="Meu Perfil">
        <div className="flex items-center justify-center py-20 text-text-muted">
          <Loader2 className="animate-spin mr-2" size={18} /> Carregando…
        </div>
      </AppShell>
    );
  }

  const initials =
    (profile.display_name ?? "U")
      .split(" ")
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "U";

  const dataProvaFmt = profile.data_prova
    ? format(new Date(profile.data_prova + "T00:00:00"), "MMMM 'de' yyyy", { locale: ptBR })
    : null;
  const desdeFmt = format(new Date(profile.created_at), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <AppShell title="Meu Perfil">
      {/* Resumo / Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Horas estudadas" value="26h 15m" hint="esta semana" tone="sage" />
        <MetricCard label="Questões feitas" value="412" hint="78% de acerto" tone="blush" />
        <MetricCard label="🔥 Sequência" value="14 dias" hint="seu recorde: 22" tone="lilac" />
        <MetricCard label="Medalhas" value="9 / 24" hint="próxima: Madrugadora" tone="sky" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <WeeklyPerformance />
        <TodaySchedule />
        <GroupRanking />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 mb-6">
        {/* Coluna esquerda */}
        <div className="lei-card">
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="h-[120px] w-[120px] border-4 border-card shadow-sm">
                {profile.avatar_url ? (
                  <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? ""} />
                ) : null}
                <AvatarFallback className="bg-sage-light text-sage-dark text-[28px] font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Editar avatar"
                className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-sage-dark text-white flex items-center justify-center shadow-md hover:bg-sage-dark/90 transition disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarUpload(f);
                  e.target.value = "";
                }}
              />
            </div>

            {destaqueBadge && (
              <div
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
                style={{
                  backgroundColor: corMap[destaqueBadge.cor]?.bg,
                  color: corMap[destaqueBadge.cor]?.ring,
                }}
              >
                <span>{destaqueBadge.icone}</span>
                <span>{destaqueBadge.nome}</span>
              </div>
            )}

            <div className="mt-4 w-full flex items-center justify-center gap-2">
              {editingName ? (
                <>
                  <Input
                    value={nameValue}
                    onChange={(e) => setNameValue(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") {
                        setNameValue(profile.display_name ?? "");
                        setEditingName(false);
                      }
                    }}
                    className="text-center font-serif text-[18px]"
                  />
                  <Button size="sm" onClick={handleSaveName}>
                    Salvar
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="font-serif text-[20px] text-text-main">
                    {profile.display_name ?? "Sem nome"}
                  </h2>
                  <button
                    onClick={() => setEditingName(true)}
                    aria-label="Editar nome"
                    className="text-text-muted hover:text-text-main transition"
                  >
                    <Pencil size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            <div>
              <label className="text-[11px] uppercase tracking-wider text-text-muted">
                Bio
              </label>
              <Textarea
                value={bioValue}
                onChange={(e) => setBioValue(e.target.value.slice(0, 120))}
                onBlur={() => handleSaveBio(bioValue)}
                placeholder="Ex: Estudando para TJSP • 6 meses de jornada"
                maxLength={120}
                rows={2}
                className="mt-1 resize-none"
              />
              <div className="text-right text-[10px] text-text-muted mt-1">
                {bioValue.length}/120
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-text-muted">
                Concurso alvo
              </label>
              <Input
                value={concursoValue}
                onChange={(e) => setConcursoValue(e.target.value)}
                onBlur={handleSaveMeta}
                placeholder="Ex: TJSP"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-text-muted">
                Data da prova
              </label>
              <Input
                type="date"
                value={dataProvaValue}
                onChange={(e) => setDataProvaValue(e.target.value)}
                onBlur={handleSaveMeta}
                className="mt-1"
              />
              {(profile.concurso_alvo || dataProvaFmt) && (
                <div className="mt-2 text-[12px] text-text-main">
                  Meta: <strong>{profile.concurso_alvo ?? "—"}</strong>
                  {dataProvaFmt && <> • {dataProvaFmt}</>}
                </div>
              )}
            </div>

            <div className="text-[12px] text-text-muted">
              Estudando desde <strong className="text-text-main">{desdeFmt}</strong>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-text-muted">
                Email
              </label>
              <div className="mt-1 text-[13px] text-text-main truncate">
                {user?.email ?? "—"}
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider text-text-muted">
                Telefone
              </label>
              {editingPhone ? (
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type="tel"
                    inputMode="numeric"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(maskPhoneBR(e.target.value))}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSavePhone();
                      if (e.key === "Escape") {
                        setPhoneValue(profile.telefone ?? "");
                        setEditingPhone(false);
                      }
                    }}
                  />
                  <Button size="sm" onClick={handleSavePhone}>
                    Salvar
                  </Button>
                  <button
                    onClick={() => {
                      setPhoneValue(profile.telefone ?? "");
                      setEditingPhone(false);
                    }}
                    aria-label="Cancelar"
                    className="text-text-muted hover:text-text-main p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span
                    className={`text-[13px] ${
                      profile.telefone ? "text-text-main" : "text-text-muted"
                    }`}
                  >
                    {profile.telefone || "Adicionar telefone"}
                  </span>
                  <button
                    onClick={() => setEditingPhone(true)}
                    aria-label="Editar telefone"
                    className="text-text-muted hover:text-text-main transition"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-[12px] bg-lilac-light border border-border px-3 py-3">
              <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                Seu Friend ID (privado)
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[13px] text-text-main font-medium">
                  {profile.friend_id}
                </span>
                <button
                  onClick={copyFriendId}
                  aria-label="Copiar friend id"
                  className="text-text-muted hover:text-text-main transition"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna direita - Badges */}
        <div className="lei-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-[17px] text-text-main">Badges</h3>
            <span className="text-[12px] text-text-muted">
              {userBadges.length} de {badges.length} conquistadas
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {badges.map((b) => {
              const ub = userBadgeMap.get(b.id);
              const unlocked = !!ub;
              const cor = corMap[b.cor] ?? corMap.sage;
              return (
                <div
                  key={b.id}
                  className={`relative rounded-[12px] border border-border p-3 flex gap-3 items-start transition ${
                    unlocked ? "bg-card" : "bg-muted/40"
                  }`}
                  style={{ opacity: unlocked ? 1 : 0.5 }}
                >
                  <div
                    className="h-11 w-11 shrink-0 rounded-full flex items-center justify-center text-[20px] relative"
                    style={{ backgroundColor: cor.bg }}
                  >
                    <span>{b.icone}</span>
                    {!unlocked && (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-card border border-border flex items-center justify-center">
                        <Lock size={10} className="text-text-muted" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-text-main truncate">
                        {b.nome}
                      </span>
                      {ub?.destaque && (
                        <Star size={12} className="fill-current text-sage-dark shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted leading-snug mt-0.5 line-clamp-2">
                      {b.descricao}
                    </p>
                    {unlocked && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          onClick={() => setDestaque(b.id)}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition ${
                            ub.destaque
                              ? "bg-sage-dark text-white border-sage-dark"
                              : "border-border text-text-muted hover:text-text-main"
                          }`}
                        >
                          {ub.destaque ? "Em destaque" : "Destacar"}
                        </button>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-text-muted">Pública</span>
                          <Switch
                            checked={ub.publica}
                            onCheckedChange={(v) => toggleBadgePublic(b.id, v)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </AppShell>
  );
}
