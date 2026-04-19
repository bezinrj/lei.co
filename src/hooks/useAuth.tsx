import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type Role = "admin" | "moderador" | "user";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  roles: Role[];
  loading: boolean;
  isAdminOrMod: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const fallbackAuthContext: AuthContextValue = {
  user: null,
  session: null,
  roles: [],
  loading: true,
  isAdminOrMod: false,
  signOut: async () => {},
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRolesForUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadRoles(userId: string) {
      if (loadedRolesForUserId.current === userId) return;
      loadedRolesForUserId.current = userId;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (!mounted) return;
      setRoles((data ?? []).map((r) => r.role as Role));
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Ignora TOKEN_REFRESHED (não muda o usuário) — evita refetch desnecessário
      if (event === "TOKEN_REFRESHED") {
        setSession(newSession);
        return;
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // Defer DB call to avoid deadlock no callback
        setTimeout(() => loadRoles(newSession.user.id), 0);
      } else {
        loadedRolesForUserId.current = null;
        setRoles([]);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadRoles(s.user.id).finally(() => mounted && setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdminOrMod = roles.includes("admin") || roles.includes("moderador");

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        loading,
        isAdminOrMod,
        signOut: async () => {
          loadedRolesForUserId.current = null;
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    if (typeof window === "undefined") return fallbackAuthContext;
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
