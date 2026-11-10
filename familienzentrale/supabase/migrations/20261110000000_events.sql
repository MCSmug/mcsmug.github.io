-- Calendar events (local entries now, iCal imports later).

create table public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- null = concerns the whole family
  member_id uuid references public.members (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  starts_at timestamptz not null,
  -- Exclusive end. All-day events run from local midnight to local midnight.
  ends_at timestamptz not null,
  all_day boolean not null default false,
  source text not null default 'local' check (source in ('local', 'ical')),
  external_id text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index events_family_range_idx on public.events (family_id, starts_at, ends_at);

revoke all on public.events from anon, authenticated;
grant select, delete on public.events to authenticated;
grant insert (id, family_id, member_id, title, starts_at, ends_at, all_day) on public.events to authenticated;
grant update (member_id, title, starts_at, ends_at, all_day) on public.events to authenticated;

alter table public.events enable row level security;

create policy "family members can read events"
  on public.events for select to authenticated
  using (public.is_family_member(family_id));

create policy "family members can add local events"
  on public.events for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and source = 'local'
    and (
      member_id is null
      or exists (
        select 1 from public.members m
        where m.id = member_id and m.family_id = events.family_id
      )
    )
  );

-- Imported (iCal) events are owned by the sync and stay read-only in the app.
create policy "family members can update local events"
  on public.events for update to authenticated
  using (public.is_family_member(family_id) and source = 'local')
  with check (
    public.is_family_member(family_id)
    and source = 'local'
    and (
      member_id is null
      or exists (
        select 1 from public.members m
        where m.id = member_id and m.family_id = events.family_id
      )
    )
  );

create policy "family members can delete local events"
  on public.events for delete to authenticated
  using (public.is_family_member(family_id) and source = 'local');

alter publication supabase_realtime add table public.events;
