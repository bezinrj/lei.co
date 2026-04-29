-- Revoga execução pelo anon (mantém para authenticated)
REVOKE EXECUTE ON FUNCTION public.is_grupo_membro(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_grupo_fundador(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.add_fundador_on_grupo_insert() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.is_grupo_membro(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_grupo_fundador(uuid, uuid) TO authenticated;