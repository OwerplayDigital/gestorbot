CREATE TABLE IF NOT EXISTS public.client_payment_links (
  cliente_id uuid PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Za-z0-9_-]{10}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_payment_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_payment_links FROM anon, authenticated;
GRANT SELECT ON public.client_payment_links TO authenticated;
DROP POLICY IF EXISTS client_payment_links_owner ON public.client_payment_links;
CREATE POLICY client_payment_links_owner ON public.client_payment_links
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_id AND c.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.get_or_create_pix_link(p_client_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  result text;
  candidate text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '42501';
  END IF;
  PERFORM 1 FROM public.clientes
    WHERE id = p_client_id AND user_id = auth.uid() FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente indisponível.' USING ERRCODE = '42501';
  END IF;
  SELECT code INTO result FROM public.client_payment_links WHERE cliente_id = p_client_id;
  IF result IS NOT NULL THEN RETURN result; END IF;
  LOOP
    candidate := substr(translate(encode(pg_catalog.uuid_send(pg_catalog.gen_random_uuid()), 'base64'), '+/', '-_'), 1, 10);
    BEGIN
      INSERT INTO public.client_payment_links(cliente_id, code)
        VALUES (p_client_id, candidate)
        ON CONFLICT (cliente_id) DO NOTHING RETURNING code INTO result;
      IF result IS NULL THEN
        SELECT code INTO result FROM public.client_payment_links WHERE cliente_id = p_client_id;
      END IF;
      IF result IS NOT NULL THEN RETURN result; END IF;
    EXCEPTION WHEN unique_violation THEN
      -- Colisão de código: sorteia outro sem afetar o cliente.
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_pix_link(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_pix_link(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_pix_checkout(p_code text)
RETURNS TABLE (nome text, vencimento date, plan_price numeric, desconto numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT split_part(trim(c.nome), ' ', 1), c.vencimento,
    COALESCE(p.price, 0), COALESCE(c.desconto, 0)
  FROM public.client_payment_links l
  JOIN public.clientes c ON c.id = l.cliente_id
  LEFT JOIN public.plans p ON p.id = c.plano_id
  WHERE p_code ~ '^[A-Za-z0-9_-]{10}$' AND l.code = p_code
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_pix_checkout(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pix_checkout(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';