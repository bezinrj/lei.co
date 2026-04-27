insert into storage.buckets (id, name, public)
values ('loja-imagens', 'loja-imagens', true)
on conflict (id) do nothing;

create policy "loja_imagens_select"
  on storage.objects for select
  using (bucket_id = 'loja-imagens');

create policy "loja_imagens_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'loja-imagens'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

create policy "loja_imagens_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'loja-imagens'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );

create policy "loja_imagens_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'loja-imagens'
    and public.has_role(auth.uid(), 'admin'::public.app_role)
  );