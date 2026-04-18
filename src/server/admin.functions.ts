import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  display_name: string | null;
  friend_id: string | null;
  roles: string[];
  last_seen_at: string | null;
  online: boolean;
};

const ONLINE_WINDOW_MS = 2 * 60 * 1000;

async function requireAdminAccess(accessToken: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Configuração de autenticação ausente no servidor");
  }

  if (!accessToken) {
    throw new Error("Sessão inválida");
  }

  const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(accessToken);
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    throw new Error("Sessão expirada ou inválida");
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (roleError || !isAdmin) {
    throw new Error("Acesso negado");
  }

  return { userId };
}

export const listAdminUsers = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string }) => input)
  .handler(async ({ data }) => {
    await requireAdminAccess(data.accessToken);

    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (usersErr) throw new Error(usersErr.message);

    const ids = usersData.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }, { data: presence }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, friend_id").in("id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
      supabaseAdmin.from("presence").select("user_id, last_seen_at").in("user_id", ids),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rolesMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });
    const presMap = new Map((presence ?? []).map((p) => [p.user_id, p.last_seen_at]));

    const now = Date.now();
    const result: AdminUser[] = usersData.users.map((u) => {
      const lastSeen = presMap.get(u.id) ?? null;
      const online = lastSeen ? now - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS : false;
      const prof = profMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        display_name: prof?.display_name ?? null,
        friend_id: prof?.friend_id ?? null,
        roles: rolesMap.get(u.id) ?? [],
        last_seen_at: lastSeen,
        online,
      };
    });

    result.sort((a, b) => Number(b.online) - Number(a.online) || (b.created_at > a.created_at ? 1 : -1));
    return { users: result };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { accessToken: string; userId: string; role: "admin" | "moderador" | "user"; enabled: boolean }) => input,
  )
  .handler(async ({ data }) => {
    await requireAdminAccess(data.accessToken);

    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
