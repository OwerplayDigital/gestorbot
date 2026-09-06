ALTER TABLE public.revendedores
ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_revendedores_public_token
ON public.revendedores(public_token);

CREATE OR REPLACE FUNCTION public.get_reseller_statement(p_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'nome', r.nome,
    'movimentacoes', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', rc.id,
          'data', rc.data,
          'quantidade_creditos', rc.quantidade_creditos,
          'custo', rc.custo,
          'servidor', COALESCE(s.name, rc.servidor, 'Painel')
        )
        ORDER BY rc.data DESC, rc.created_at DESC
      )
      FROM public.reseller_credits rc
      LEFT JOIN public.servidores_iptv s ON s.id = rc.servidor_id
      WHERE rc.reseller_id = r.id
    ), '[]'::jsonb)
  )
  FROM public.revendedores r
  WHERE r.public_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_reseller_statement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reseller_statement(uuid) TO anon, authenticated;
