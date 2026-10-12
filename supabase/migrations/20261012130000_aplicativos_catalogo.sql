-- Catálogo personalizado por usuário; os 11 aplicativos iniciais são fornecidos pelo app.
create table if not exists public.aplicativos_catalogo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  nome text not null check (length(btrim(nome)) > 0),
  icon_url text,
  painel_url text,
  created_at timestamptz not null default now()
);
create unique index if not exists aplicativos_catalogo_nome_usuario on public.aplicativos_catalogo (user_id, lower(regexp_replace(btrim(nome), '\s+', ' ', 'g')));
alter table public.aplicativos_catalogo enable row level security;
create policy "Catálogo de aplicativos do próprio usuário" on public.aplicativos_catalogo
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
grant select, insert, update, delete on public.aplicativos_catalogo to authenticated;
grant all on public.aplicativos_catalogo to service_role;

-- Ícones enviados como arquivos, sem base64 na tabela.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-icons', 'application-icons', true, 300000, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;
create policy "Ler ícones de aplicativos" on storage.objects for select
  using (bucket_id = 'application-icons');
create policy "Enviar ícones próprios" on storage.objects for insert to authenticated
  with check (bucket_id = 'application-icons' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Excluir ícones próprios" on storage.objects for delete to authenticated
  using (bucket_id = 'application-icons' and (storage.foldername(name))[1] = auth.uid()::text);
