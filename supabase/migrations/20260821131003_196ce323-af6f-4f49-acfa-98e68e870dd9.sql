CREATE TABLE IF NOT EXISTS public.telegram_message_logs (
    id uuid primary key default gen_random_uuid(),
    telegram_chat_id bigint not null,
    message_id bigint not null,
    created_at timestamptz default now()
);

-- Grant access
GRANT ALL ON public.telegram_message_logs TO service_role;
GRANT SELECT, INSERT, DELETE ON public.telegram_message_logs TO authenticated;

-- Enable RLS
ALTER TABLE public.telegram_message_logs ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Service and authenticated can manage logs"
ON public.telegram_message_logs
FOR ALL
TO authenticated, service_role
USING (true);
