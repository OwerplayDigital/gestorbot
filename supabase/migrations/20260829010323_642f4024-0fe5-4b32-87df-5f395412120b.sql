CREATE OR REPLACE FUNCTION public.get_checkout_info(p_ref text)
RETURNS TABLE (
  id uuid,
  nome text,
  vencimento date,
  desconto numeric,
  plan_price numeric,
  plan_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.nome, c.vencimento, COALESCE(c.desconto,0) AS desconto,
         COALESCE(p.price, 0) AS plan_price, p.name AS plan_name
  FROM public.clientes c
  LEFT JOIN public.plans p ON p.id = c.plano_id
  WHERE (
    (p_ref ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND c.id = p_ref::uuid)
    OR regexp_replace(COALESCE(c.whatsapp,''), '\D', '', 'g') = regexp_replace(p_ref, '\D', '', 'g')
  )
  AND regexp_replace(p_ref, '\D', '', 'g') <> '' OR (p_ref ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' AND c.id = p_ref::uuid)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_checkout_info(text) TO anon, authenticated;