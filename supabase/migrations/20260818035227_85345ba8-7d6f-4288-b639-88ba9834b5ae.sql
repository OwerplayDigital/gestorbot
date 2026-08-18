-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Plans
CREATE TABLE public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own plans" ON public.plans
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 2. Servidores IPTV
CREATE TABLE public.servidores_iptv (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    name TEXT NOT NULL,
    valor NUMERIC(10,2) NOT NULL DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.servidores_iptv TO authenticated;
GRANT ALL ON public.servidores_iptv TO service_role;
ALTER TABLE public.servidores_iptv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own servers" ON public.servidores_iptv
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 3. Clientes
CREATE TABLE public.clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    nome TEXT NOT NULL,
    whatsapp TEXT,
    plano_id UUID REFERENCES public.plans(id),
    valor NUMERIC(10,2) DEFAULT 0,
    desconto NUMERIC(10,2) DEFAULT 0,
    vencimento DATE,
    status TEXT DEFAULT 'ativo',
    servidores_ids UUID[] DEFAULT '{}',
    cadastrado_em TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own clients" ON public.clientes
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 4. Transacoes
CREATE TABLE public.transacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor NUMERIC(10,2) NOT NULL DEFAULT 0,
    data DATE DEFAULT CURRENT_DATE,
    descricao TEXT,
    cliente_id UUID REFERENCES public.clientes(id),
    serv_id UUID REFERENCES public.servidores_iptv(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transacoes TO authenticated;
GRANT ALL ON public.transacoes TO service_role;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own transactions" ON public.transacoes
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 5. Renovacoes
CREATE TABLE public.renovacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL DEFAULT auth.uid(),
    cliente_id UUID REFERENCES public.clientes(id),
    plano_id UUID REFERENCES public.plans(id),
    valor NUMERIC(10,2) DEFAULT 0,
    desconto NUMERIC(10,2) DEFAULT 0,
    vencimento_anterior DATE,
    novo_vencimento DATE,
    data_renovacao TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.renovacoes TO authenticated;
GRANT ALL ON public.renovacoes TO service_role;
ALTER TABLE public.renovacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own renewals" ON public.renovacoes
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Índices
CREATE INDEX idx_plans_user_id ON public.plans(user_id);
CREATE INDEX idx_servidores_user_id ON public.servidores_iptv(user_id);
CREATE INDEX idx_clientes_user_id ON public.clientes(user_id);
CREATE INDEX idx_clientes_plano_id ON public.clientes(plano_id);
CREATE INDEX idx_clientes_vencimento ON public.clientes(vencimento);
CREATE INDEX idx_transacoes_user_id ON public.transacoes(user_id);
CREATE INDEX idx_transacoes_data ON public.transacoes(data);
CREATE INDEX idx_transacoes_cliente_id ON public.transacoes(cliente_id);
CREATE INDEX idx_transacoes_serv_id ON public.transacoes(serv_id);
CREATE INDEX idx_renovacoes_user_id ON public.renovacoes(user_id);
CREATE INDEX idx_renovacoes_cliente_id ON public.renovacoes(cliente_id);
CREATE INDEX idx_renovacoes_plano_id ON public.renovacoes(plano_id);
