-- Permite leitura pública de clientes específicos pelo ID para a página de checkout
CREATE POLICY "Public can read client by ID" ON public.clientes
    FOR SELECT
    TO anon
    USING (true);

-- Permite leitura pública de planos para carregar os detalhes no checkout
CREATE POLICY "Public can read plans" ON public.plans
    FOR SELECT
    TO anon
    USING (true);

-- Permite leitura pública de servidores (usado em joins ou detalhes)
CREATE POLICY "Public can read servers" ON public.servidores_iptv
    FOR SELECT
    TO anon
    USING (true);

-- Garante que o role anon tenha as permissões necessárias
GRANT SELECT ON public.clientes TO anon;
GRANT SELECT ON public.plans TO anon;
GRANT SELECT ON public.servidores_iptv TO anon;