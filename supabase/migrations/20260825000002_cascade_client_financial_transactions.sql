-- Mantém o financeiro consistente quando um cliente é excluído.
-- A FK antiga apenas referenciava clientes(id); sem CASCADE, a exclusão do
-- cliente era bloqueada se existisse uma transação vinculada.

ALTER TABLE public.transacoes
  DROP CONSTRAINT IF EXISTS transacoes_cliente_id_fkey;

ALTER TABLE public.transacoes
  ADD CONSTRAINT transacoes_cliente_id_fkey
  FOREIGN KEY (cliente_id)
  REFERENCES public.clientes(id)
  ON DELETE CASCADE;
