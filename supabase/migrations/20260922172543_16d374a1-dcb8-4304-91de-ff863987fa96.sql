create table if not exists public.controle_creditos (
  user_id uuid primary key references auth.users(id) on delete cascade,
  uniplay numeric(10,2) not null default 0,
  goat numeric(10,2) not null default 0,
  caixinha numeric(10,2) not null default 0,
  meta_caixinha numeric(10,2) not null default 375,
  updated_at timestamptz not null default now()
);

create table if not exists public.movimentacoes_creditos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  renovacao_id uuid null,
  cliente_id uuid null references public.clientes(id) on delete set null,
  servidor text not null,
  tipo text not null,
  creditos numeric(10,2) not null default 0,
  caixinha numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists movimentacoes_creditos_renovacao_uidx
  on public.movimentacoes_creditos(renovacao_id) where renovacao_id is not null;

grant select, insert, update, delete on public.controle_creditos to authenticated;
grant all on public.controle_creditos to service_role;
grant select, insert, update, delete on public.movimentacoes_creditos to authenticated;
grant all on public.movimentacoes_creditos to service_role;

alter table public.controle_creditos enable row level security;
alter table public.movimentacoes_creditos enable row level security;
drop policy if exists "controle_creditos_owner" on public.controle_creditos;
create policy "controle_creditos_owner" on public.controle_creditos for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "movimentacoes_creditos_owner" on public.movimentacoes_creditos;
create policy "movimentacoes_creditos_owner" on public.movimentacoes_creditos for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.registrar_consumo_credito(
  p_renovacao_id uuid, p_cliente_id uuid, p_servidor text, p_creditos numeric default 1, p_caixinha numeric default 10
) returns void language plpgsql security invoker set search_path = public as $$
declare v_user uuid := auth.uid(); v_server text := lower(trim(p_servidor));
begin
  if v_user is null then raise exception 'Nao autenticado'; end if;
  if exists(select 1 from public.movimentacoes_creditos where user_id=v_user and renovacao_id=p_renovacao_id) then return; end if;
  insert into public.controle_creditos(user_id, uniplay, goat, caixinha)
  values(v_user, 64.70, 7.84, 80)
  on conflict(user_id) do nothing;
  if v_server like '%uniplay%' then
    update public.controle_creditos set uniplay=uniplay-p_creditos, caixinha=caixinha+p_caixinha, updated_at=now() where user_id=v_user;
  elsif v_server like '%goat%' then
    update public.controle_creditos set goat=goat-p_creditos, caixinha=caixinha+p_caixinha, updated_at=now() where user_id=v_user;
  else
    return;
  end if;
  insert into public.movimentacoes_creditos(user_id, renovacao_id, cliente_id, servidor, tipo, creditos, caixinha)
  values(v_user,p_renovacao_id,p_cliente_id,p_servidor,'renovacao',p_creditos,p_caixinha);
end $$;