import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type TopbarProps = { title: string };

export function Topbar({ title }: TopbarProps) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setDisplayName(""); setAvatarUrl(null); return; }
    let mounted = true;
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!mounted || !data) return;
        setDisplayName(data.display_name ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      });
    return () => { mounted = false; };
  }, [user?.id]);

  const firstName = displayName.split(" ")[0] || "Você";
  const initials = (displayName || "U")
    .split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "U";

  return (
    <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border">
      <div className="flex items-center justify-between px-8 py-4">
        <h1 className="font-serif text-[17px] text-text-main">{title}</h1>
        <div className="flex items-center gap-3">
          {user && <span className="text-[13px] text-text-muted">Olá, {firstName}</span>}
          <Link
            to="/perfil"
            aria-label="Meu perfil"
            className="w-9 h-9 rounded-full bg-sage-light text-sage-dark flex items-center justify-center text-[12px] font-medium overflow-hidden hover:ring-2 hover:ring-sage transition"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
