import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

export const listAdminUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Verifica role admin via RLS-safe RPC
    const { data: isAdmin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr || !isAdmin) {
      throw new Response("Forbidden", { status: 403 });
    }

    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (usersErr) throw new Response(usersErr.message, { status: 500 });

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
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; role: "admin" | "moderador" | "user"; enabled: boolean }) => input)
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Response("Forbidden", { status: 403 });

    if (data.enabled) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Response(error.message, { status: 500 });
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Response(error.message, { status: 500 });
    }
    return { ok: true };
  });
