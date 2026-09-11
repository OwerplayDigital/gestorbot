create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  nota text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id)
);

alter table public.client_notes enable row level security;

drop policy if exists "Users can view own client notes" on public.client_notes;
create policy "Users can view own client notes"
on public.client_notes
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own client notes" on public.client_notes;
create policy "Users can insert own client notes"
on public.client_notes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own client notes" on public.client_notes;
create policy "Users can update own client notes"
on public.client_notes
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own client notes" on public.client_notes;
create policy "Users can delete own client notes"
on public.client_notes
for delete
to authenticated
using (auth.uid() = user_id);
