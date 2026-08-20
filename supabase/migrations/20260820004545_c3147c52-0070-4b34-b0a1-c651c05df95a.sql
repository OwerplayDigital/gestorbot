-- Criar tabela de templates de mensagens
CREATE TABLE public.message_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    type TEXT CHECK (type IN ('cobrança', 'renovação', 'personalizado')) DEFAULT 'personalizado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;

-- Políticas RLS
CREATE POLICY "Usuários podem ver seus próprios templates"
ON public.message_templates FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios templates"
ON public.message_templates FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios templates"
ON public.message_templates FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios templates"
ON public.message_templates FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Índices
CREATE INDEX idx_message_templates_user_id ON public.message_templates(user_id);
