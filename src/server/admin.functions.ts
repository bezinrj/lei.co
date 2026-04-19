import { createServerFn, createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as browserSupabase } from "@/integrations/supabase/client";

const attachAuthHeader = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const { data } = await browserSupabase.auth.getSession();
  const token = data.session?.access_token;
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});

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

async function requireAdminAccess(supabase: any, userId: string) {
  const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (roleError || !isAdmin) {
    throw new Error("Acesso negado");
  }
}

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([attachAuthHeader, requireSupabaseAuth])
    const { supabase, userId } = context;
    await requireAdminAccess(supabase, userId);

    const [{ data: profiles, error: profilesErr }, { data: roles, error: rolesErr }, { data: presence, error: presenceErr }] = await Promise.all([
      supabase.from("profiles").select("id, display_name, friend_id, created_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("presence").select("user_id, last_seen_at"),
    ]);

    if (profilesErr) throw new Error(profilesErr.message);
    if (rolesErr) throw new Error(rolesErr.message);
    if (presenceErr) throw new Error(presenceErr.message);

    const rolesMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });

    const presMap = new Map((presence ?? []).map((p) => [p.user_id, p.last_seen_at]));
    const now = Date.now();

    const result: AdminUser[] = (profiles ?? []).map((profile) => {
      const lastSeen = presMap.get(profile.id) ?? null;
      return {
        id: profile.id,
        email: null,
        created_at: profile.created_at,
        last_sign_in_at: null,
        display_name: profile.display_name ?? null,
        friend_id: profile.friend_id ?? null,
        roles: rolesMap.get(profile.id) ?? [],
        last_seen_at: lastSeen,
        online: lastSeen ? now - new Date(lastSeen).getTime() < ONLINE_WINDOW_MS : false,
      };
    });

    result.sort((a, b) => Number(b.online) - Number(a.online) || (b.created_at > a.created_at ? 1 : -1));
    return { users: result };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { userId: string; role: "admin" | "moderador" | "user"; enabled: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireAdminAccess(supabase, userId);

    if (data.enabled) {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
