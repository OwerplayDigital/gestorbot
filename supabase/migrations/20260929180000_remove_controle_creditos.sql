-- Remove definitivamente o módulo de controle de créditos/caixinha.
-- Não altera clientes, servidores, renovações, transações financeiras ou push.

drop function if exists public.registrar_consumo_credito(uuid, uuid, text, numeric, numeric);
drop table if exists public.movimentacoes_creditos;
drop table if exists public.controle_creditos;
