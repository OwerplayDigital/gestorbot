alter table public.clientes
  add column if not exists aplicativo text,
  add column if not exists app_mac text,
  add column if not exists app_key text;

comment on column public.clientes.aplicativo is 'Aplicativo/player utilizado pelo cliente';
comment on column public.clientes.app_mac is 'MAC utilizado no aplicativo do cliente';
comment on column public.clientes.app_key is 'Chave/Key utilizada no aplicativo do cliente';
