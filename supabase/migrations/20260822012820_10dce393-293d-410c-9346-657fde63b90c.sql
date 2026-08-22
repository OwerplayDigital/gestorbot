
-- 1. Tabela de Dispositivos
CREATE TABLE public.dispositivos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    app_nome text NOT NULL,
    mac_address text NOT NULL,
    app_key text,
    created_at timestamptz DEFAULT now()
);

-- 2. Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dispositivos TO authenticated;
GRANT ALL ON public.dispositivos TO service_role;

-- 3. RLS
ALTER TABLE public.dispositivos ENABLE ROW LEVEL SECURITY;

-- 4. Política (isolamento por cliente que pertence ao usuário)
CREATE POLICY "Usuários podem gerenciar dispositivos dos seus clientes"
ON public.dispositivos
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.clientes
        WHERE public.clientes.id = public.dispositivos.cliente_id
        AND public.clientes.user_id = auth.uid()
    )
);
