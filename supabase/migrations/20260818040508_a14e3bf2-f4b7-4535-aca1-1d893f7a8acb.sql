
-- Tabela para autorizar chats do Telegram
CREATE TABLE public.telegram_authorized_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    telegram_chat_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(telegram_chat_id)
);

-- Permissões
GRANT SELECT, INSERT, DELETE ON public.telegram_authorized_users TO authenticated;
GRANT ALL ON public.telegram_authorized_users TO service_role;

-- RLS
ALTER TABLE public.telegram_authorized_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own telegram links"
ON public.telegram_authorized_users
FOR ALL
TO authenticated
USING (auth.uid() = user_id);

-- Índice para busca rápida por chat_id
CREATE INDEX idx_telegram_chat_id ON public.telegram_authorized_users(telegram_chat_id);
