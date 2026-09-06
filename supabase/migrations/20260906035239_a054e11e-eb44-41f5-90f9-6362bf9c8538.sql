ALTER TABLE public.revendedores ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

ALTER TABLE public.reseller_credits ADD COLUMN IF NOT EXISTS servidor_id uuid REFERENCES public.servidores_iptv(id) ON DELETE SET NULL;
ALTER TABLE public.reseller_credits ADD COLUMN IF NOT EXISTS observacao text;
ALTER TABLE public.reseller_credits ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.reseller_credits ALTER COLUMN data SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reseller_credits_reseller_data ON public.reseller_credits (reseller_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_revendedores_user ON public.revendedores (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.revendedores TO authenticated;
GRANT ALL ON public.revendedores TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reseller_credits TO authenticated;
GRANT ALL ON public.reseller_credits TO service_role;