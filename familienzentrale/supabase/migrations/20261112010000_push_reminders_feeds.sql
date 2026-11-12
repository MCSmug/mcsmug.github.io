-- Web Push subscriptions, timed reminders and subscribed (iCal) calendars.

-- ---------------------------------------------------------------------------
-- Push subscriptions: one row per device and member
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_member_idx on public.push_subscriptions (member_id);

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant insert (member_id, endpoint, p256dh, auth) on public.push_subscriptions to authenticated;

alter table public.push_subscriptions enable row level security;

-- Only the member's own account sees and manages its devices; sending happens
-- in the notify function with the service role.
create policy "members can read their own subscriptions"
  on public.push_subscriptions for select to authenticated
  using (exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid())));

create policy "members can add their own subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid())));

create policy "members can remove their own subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Reminders: a push message at a given time, for one member or for everyone
-- ---------------------------------------------------------------------------

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- null = everyone in the family
  target_member_id uuid references public.members (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 200),
  fire_at timestamptz not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index reminders_due_idx on public.reminders (fire_at) where sent_at is null;
create index reminders_family_idx on public.reminders (family_id, fire_at);

revoke all on public.reminders from anon, authenticated;
grant select, delete on public.reminders to authenticated;
grant insert (family_id, target_member_id, text, fire_at) on public.reminders to authenticated;

alter table public.reminders enable row level security;

create policy "family members can read reminders"
  on public.reminders for select to authenticated
  using (public.is_family_member(family_id));

create policy "family members can add reminders"
  on public.reminders for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and (
      target_member_id is null
      or exists (
        select 1 from public.members m
        where m.id = target_member_id and m.family_id = reminders.family_id
      )
    )
  );

create policy "family members can delete reminders"
  on public.reminders for delete to authenticated
  using (public.is_family_member(family_id));

alter publication supabase_realtime add table public.reminders;

-- ---------------------------------------------------------------------------
-- Subscribed calendars (iCal URLs), imported by the sync-calendars function
-- ---------------------------------------------------------------------------

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Whose calendar it is (colour of the imported events); null = whole family.
  member_id uuid references public.members (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  -- The "secret address" of the calendar. Anyone who knows it can read the calendar.
  ical_url text not null check (ical_url ~* '^https://' and char_length(ical_url) <= 2000),
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create index calendar_feeds_family_idx on public.calendar_feeds (family_id);

revoke all on public.calendar_feeds from anon, authenticated;
grant select, delete on public.calendar_feeds to authenticated;
grant insert (family_id, member_id, name, ical_url) on public.calendar_feeds to authenticated;
grant update (member_id, name) on public.calendar_feeds to authenticated;

alter table public.calendar_feeds enable row level security;

create policy "family members can read calendar feeds"
  on public.calendar_feeds for select to authenticated
  using (public.is_family_member(family_id));

create policy "parents can add calendar feeds"
  on public.calendar_feeds for insert to authenticated
  with check (
    public.is_family_parent(family_id)
    and (
      member_id is null
      or exists (select 1 from public.members m where m.id = member_id and m.family_id = calendar_feeds.family_id)
    )
  );

create policy "parents can update calendar feeds"
  on public.calendar_feeds for update to authenticated
  using (public.is_family_parent(family_id))
  with check (
    public.is_family_parent(family_id)
    and (
      member_id is null
      or exists (select 1 from public.members m where m.id = member_id and m.family_id = calendar_feeds.family_id)
    )
  );

create policy "parents can delete calendar feeds"
  on public.calendar_feeds for delete to authenticated
  using (public.is_family_parent(family_id));

-- Imported events belong to their feed and disappear with it.
alter table public.events
  add column feed_id uuid references public.calendar_feeds (id) on delete cascade;

-- Not partial, so upserts can target it; local events have feed_id null and never collide.
create unique index events_feed_external_idx on public.events (feed_id, external_id);

-- Replaces all imported events of one feed in a single transaction.
-- Called by the sync-calendars function with the service role only.
create function public.replace_feed_events(p_feed_id uuid, p_events jsonb)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  feed public.calendar_feeds%rowtype;
  inserted integer;
begin
  select * into feed from public.calendar_feeds where id = p_feed_id;
  if not found then
    return 0;
  end if;

  delete from public.events where feed_id = p_feed_id;

  insert into public.events (family_id, member_id, feed_id, source, external_id, title, starts_at, ends_at, all_day)
  select feed.family_id, feed.member_id, feed.id, 'ical', e.external_id, e.title, e.starts_at, e.ends_at, e.all_day
  from jsonb_to_recordset(p_events) as e(
    external_id text, title text, starts_at timestamptz, ends_at timestamptz, all_day boolean
  )
  on conflict (feed_id, external_id) do nothing;

  get diagnostics inserted = row_count;
  update public.calendar_feeds set last_synced_at = now(), last_error = null where id = p_feed_id;
  return inserted;
end;
$$;

revoke all on function public.replace_feed_events(uuid, jsonb) from public, anon, authenticated;

alter publication supabase_realtime add table public.calendar_feeds;

-- ---------------------------------------------------------------------------
-- Server-side access for the Edge Functions (service role).
-- Granted explicitly and narrowly: projects created without "automatically
-- expose new tables" give the service role no default privileges.
-- ---------------------------------------------------------------------------

-- notify: look up recipients, forget dead devices, claim due reminders
grant select on public.members, public.messages to service_role;
grant select, delete on public.push_subscriptions to service_role;
grant select, update (sent_at) on public.reminders to service_role;

-- sync-calendars: read feeds, record the outcome, replace the imported events
grant select, update (last_synced_at, last_error) on public.calendar_feeds to service_role;
grant execute on function public.replace_feed_events(uuid, jsonb) to service_role;
