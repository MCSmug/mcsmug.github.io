-- Scheduled jobs. Not a migration: the project URL is specific to one installation.
-- Replace YOUR-PROJECT-REF, then run once in the SQL editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every minute: send reminders that are due (only calls the function when there is one).
select cron.schedule(
  'send-due-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/notify',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"due": true}'::jsonb
  )
  where exists (select 1 from public.reminders where sent_at is null and fire_at <= now());
  $$
);

-- Every 30 minutes: refresh subscribed calendars (only when there are any).
select cron.schedule(
  'sync-calendars',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/sync-calendars',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )
  where exists (select 1 from public.calendar_feeds);
  $$
);
