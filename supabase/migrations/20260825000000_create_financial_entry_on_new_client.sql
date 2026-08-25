-- Mantém o cadastro de novos clientes sincronizado com o financeiro.
-- O fluxo do Telegram já cria o registro em clientes, mas não criava a
-- movimentação correspondente em transacoes.

CREATE OR REPLACE FUNCTION public.registrar_financeiro_novo_cliente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_price numeric(10,2) := 0;
  v_total_custo numeric(10,2) := 0;
  v_valor_entrada numeric(10,2) := 0;
BEGIN
  SELECT COALESCE(price, 0)
    INTO v_plan_price
    FROM public.plans
   WHERE id = NEW.plano_id;

  IF NEW.servidores_ids IS NOT NULL AND cardinality(NEW.servidores_ids) > 0 THEN
    SELECT COALESCE(SUM(COALESCE(s.valor, 0)), 0)
      INTO v_total_custo
      FROM public.servidores_iptv s
     WHERE s.id = ANY(NEW.servidores_ids);
  END IF;

  v_valor_entrada := GREATEST(0, v_plan_price - COALESCE(NEW.desconto, 0));

  INSERT INTO public.transacoes (
    user_id,
    cliente_id,
    tipo,
    entrada,
    custo,
    valor,
    data,
    descricao,
    serv_id
  )
  VALUES (
    NEW.user_id,
    NEW.id,
    'entrada',
    v_valor_entrada,
    v_total_custo,
    v_valor_entrada,
    COALESCE(NEW.created_at::date, CURRENT_DATE),
    'Cadastro cliente ' || NEW.id,
    CASE
      WHEN NEW.servidores_ids IS NOT NULL AND cardinality(NEW.servidores_ids) > 0
      THEN NEW.servidores_ids[1]
      ELSE NULL
    END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_financeiro_novo_cliente ON public.clientes;

CREATE TRIGGER trg_financeiro_novo_cliente
AFTER INSERT ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.registrar_financeiro_novo_cliente();
