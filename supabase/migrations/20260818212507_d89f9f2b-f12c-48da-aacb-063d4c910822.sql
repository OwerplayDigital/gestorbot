
ALTER TABLE public.telegram_authorized_users 
ADD COLUMN IF NOT EXISTS current_step TEXT;

-- Garantir que a service_role possa atualizar o step
GRANT UPDATE(current_step) ON public.telegram_authorized_users TO service_role;
