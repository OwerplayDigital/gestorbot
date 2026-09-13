create table if not exists public.pendencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  valor numeric(10,2) not null default 0 check (valor >= 0),
  data_combinada date null,
  observacao text not null default '',
  status text not null default 'pendente' check (status in ('pendente', 'pago')),
  pago_em timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pendencias_user_status_idx on public.pendencias(user_id, status);
create index if not exists pendencias_data_combinada_idx on public.pendencias(data_combinada);
create index if not exists pendencias_cliente_idx on public.pendencias(cliente_id);

alter table public.pendencias enable row level security;

create policy "Users can view own pendencias" on public.pendencias for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert own pendencias" on public.pendencias for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update own pendencias" on public.pendencias for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own pendencias" on public.pendencias for delete to authenticated using (auth.uid() = user_id);
