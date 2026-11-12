-- Family chat, photo import usage (cost limit) and account/family deletion.

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Kept when the author is removed, shown as "ehemaliges Mitglied".
  author_id uuid references public.members (id) on delete set null,
  text text not null check (char_length(btrim(text)) between 1 and 1000),
  send_push boolean not null default false,
  created_at timestamptz not null default now()
);

create index messages_family_idx on public.messages (family_id, created_at);

revoke all on public.messages from anon, authenticated;
grant select, delete on public.messages to authenticated;
grant insert (id, family_id, author_id, text, send_push) on public.messages to authenticated;

alter table public.messages enable row level security;

create policy "family members can read messages"
  on public.messages for select to authenticated
  using (public.is_family_member(family_id));

-- A message is always written in the name of the signed-in member.
create policy "members can write messages as themselves"
  on public.messages for insert to authenticated
  with check (
    exists (
      select 1 from public.members m
      where m.id = author_id
        and m.family_id = messages.family_id
        and m.user_id = (select auth.uid())
    )
  );

create policy "members can delete their own messages"
  on public.messages for delete to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = author_id and m.user_id = (select auth.uid())
    )
  );

alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Photo import usage: one row per analysed photo, counted per family and month
-- by the extract-events function to cap API costs.
-- ---------------------------------------------------------------------------

create table public.photo_imports (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index photo_imports_family_idx on public.photo_imports (family_id, created_at);

revoke all on public.photo_imports from anon, authenticated;
grant select on public.photo_imports to authenticated;
grant insert (family_id) on public.photo_imports to authenticated;

alter table public.photo_imports enable row level security;

create policy "family members can read photo imports"
  on public.photo_imports for select to authenticated
  using (public.is_family_member(family_id));

create policy "family members can record photo imports"
  on public.photo_imports for insert to authenticated
  with check (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- Deleting data
-- ---------------------------------------------------------------------------

-- Deletes a family with everything in it. Parents only.
create function public.delete_family(p_family_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_family_parent(p_family_id) then
    raise exception 'not allowed';
  end if;
  delete from public.families where id = p_family_id;
end;
$$;

-- Deletes the caller's account. Families in which the caller is the only
-- parent with a login are deleted as well, so no data is left without an
-- owner; in other families the member entry stays but loses its login.
create function public.delete_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'not authenticated';
  end if;

  delete from public.families f
  where exists (
      select 1 from public.members m
      where m.family_id = f.id and m.user_id = caller and m.role = 'parent'
    )
    and not exists (
      select 1 from public.members m
      where m.family_id = f.id and m.role = 'parent'
        and m.user_id is not null and m.user_id <> caller
    );

  delete from auth.users where id = caller;
end;
$$;

revoke all on function public.delete_family(uuid) from public, anon;
revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_family(uuid) to authenticated;
grant execute on function public.delete_account() to authenticated;
