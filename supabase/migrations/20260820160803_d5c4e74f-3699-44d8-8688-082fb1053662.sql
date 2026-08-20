-- Ativar as extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover tarefa antiga se existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-notifications-job') THEN
        PERFORM cron.unschedule('daily-notifications-job');
    END IF;
END $$;

-- Agendar o novo disparo para 08:30 BRT (11:30 UTC)
-- O host estável gestorbot.lovable.app
SELECT cron.schedule(
  'daily-notifications-job',
  '30 11 * * *',
  $$
  SELECT net.http_get(
    url := 'https://gestorbot.lovable.app/api/public/cron-notifications',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Execução manual imediata para teste
SELECT net.http_get(
  url := 'https://gestorbot.lovable.app/api/public/cron-notifications?test=true',
  headers := '{"Content-Type": "application/json"}'::jsonb
);