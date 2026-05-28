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
  const rolesPromiseRef = useRef<Map<string, Promise<void>>>(new Map());

  useEffect(() => {
    let mounted = true;

    function loadRoles(userId: string): Promise<void> {
      const existing = rolesPromiseRef.current.get(userId);
      if (existing) return existing;
      const p = (async () => {
        const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
        if (!mounted) return;
        setRoles((data ?? []).map((r) => r.role as Role));
      })();
      rolesPromiseRef.current.set(userId, p);
      return p;
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "TOKEN_REFRESHED") {
        setSession(newSession);
        return;
      }

      setSession(newSession);
      const newUser = newSession?.user ?? null;
      setUser((prev) => (prev?.id === newUser?.id ? prev : newUser));

      if (newUser) {
        setLoading(true);
        void loadRoles(newUser.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        rolesPromiseRef.current.clear();
        setRoles([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      const newUser = s?.user ?? null;
      setUser((prev) => (prev?.id === newUser?.id ? prev : newUser));
      if (newUser) {
        try {
          await loadRoles(newUser.id);
        } finally {
          if (mounted) setLoading(false);
        }
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
          rolesPromiseRef.current.clear();
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
