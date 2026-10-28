-- A exclusão de clientes com histórico era bloqueada por esta FK.
-- A operação continua atômica: se outra restrição falhar, nada é removido.
BEGIN;

ALTER TABLE public.renovacoes
  DROP CONSTRAINT IF EXISTS renovacoes_cliente_id_fkey;

ALTER TABLE public.renovacoes
  ADD CONSTRAINT renovacoes_cliente_id_fkey
  FOREIGN KEY (cliente_id)
  REFERENCES public.clientes(id)
  ON DELETE CASCADE;

COMMIT;
