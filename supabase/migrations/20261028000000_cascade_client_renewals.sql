-- Permite excluir o cadastro sem apagar o histórico de renovações.
-- cliente_id já é opcional no esquema original.
BEGIN;

ALTER TABLE public.renovacoes
  DROP CONSTRAINT IF EXISTS renovacoes_cliente_id_fkey;

ALTER TABLE public.renovacoes
  ADD CONSTRAINT renovacoes_cliente_id_fkey
  FOREIGN KEY (cliente_id)
  REFERENCES public.clientes(id)
  ON DELETE SET NULL;

COMMIT;
