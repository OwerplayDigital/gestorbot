ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS entrada numeric(10,2) DEFAULT 0;
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS custo numeric(10,2) DEFAULT 0;
ALTER TABLE public.transacoes ADD COLUMN IF NOT EXISTS lucro_liquido numeric(10,2) GENERATED ALWAYS AS (entrada - custo) STORED;
DELETE FROM public.transacoes;