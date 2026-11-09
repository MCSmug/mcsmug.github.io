-- Stage 1: families, members, shopping list.
-- Access rule everywhere: only members of the same family may see or change rows.

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Children have no login (user_id is null), parents do.
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  role text not null check (role in ('parent', 'child')),
  avatar text,
  -- A parent without a login yet: the account that signs in with this
  -- (verified) e-mail address is linked to the member by claim_invites().
  invite_email text check (invite_email is null or role = 'parent'),
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create index members_user_id_idx on public.members (user_id);
create index members_invite_email_idx on public.members (lower(invite_email))
  where invite_email is not null;

create table public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  added_by uuid references public.members (id) on delete set null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index shopping_items_family_idx on public.shopping_items (family_id, created_at);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies on members do not recurse)
-- ---------------------------------------------------------------------------

create function public.is_family_member(fid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.family_id = fid and m.user_id = (select auth.uid())
  );
$$;

create function public.is_family_parent(fid uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.family_id = fid and m.user_id = (select auth.uid()) and m.role = 'parent'
  );
$$;

-- Creates a family together with the first parent member (the caller).
create function public.create_family(family_name text, member_name text, member_color text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_family_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  insert into public.families (name) values (btrim(family_name))
  returning id into new_family_id;

  insert into public.members (family_id, user_id, name, color, role)
  values (new_family_id, (select auth.uid()), btrim(member_name), member_color, 'parent');

  return new_family_id;
end;
$$;

-- Links the signed-in user to parent members that were invited by e-mail.
create function public.claim_invites()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  caller_email text := lower(nullif((select auth.jwt()) ->> 'email', ''));
  claimed integer;
begin
  if (select auth.uid()) is null or caller_email is null then
    return 0;
  end if;

  update public.members m
  set user_id = (select auth.uid()), invite_email = null
  where m.user_id is null
    and m.role = 'parent'
    and lower(m.invite_email) = caller_email
    and not exists (
      select 1 from public.members own
      where own.family_id = m.family_id and own.user_id = (select auth.uid())
    );

  get diagnostics claimed = row_count;
  return claimed;
end;
$$;

revoke all on function public.is_family_member(uuid) from public, anon;
revoke all on function public.is_family_parent(uuid) from public, anon;
revoke all on function public.create_family(text, text, text) from public, anon;
revoke all on function public.claim_invites() from public, anon;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_parent(uuid) to authenticated;
grant execute on function public.create_family(text, text, text) to authenticated;
grant execute on function public.claim_invites() to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges: only signed-in users, and only the columns they may write.
-- user_id is never writable from the client (set by create_family/claim_invites).
-- ---------------------------------------------------------------------------

revoke all on public.families, public.members, public.shopping_items from anon, authenticated;

grant select, update (name) on public.families to authenticated;

grant select, delete on public.members to authenticated;
grant insert (family_id, name, color, role, avatar, invite_email) on public.members to authenticated;
grant update (name, color, role, avatar, invite_email) on public.members to authenticated;

grant select, delete on public.shopping_items to authenticated;
grant insert (id, family_id, name, added_by, done) on public.shopping_items to authenticated;
grant update (name, done) on public.shopping_items to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.shopping_items enable row level security;

create policy "family members can read their family"
  on public.families for select to authenticated
  using (public.is_family_member(id));

create policy "parents can rename their family"
  on public.families for update to authenticated
  using (public.is_family_parent(id))
  with check (public.is_family_parent(id));

create policy "family members can read members"
  on public.members for select to authenticated
  using (public.is_family_member(family_id));

create policy "parents can add members"
  on public.members for insert to authenticated
  with check (public.is_family_parent(family_id));

create policy "parents can update members"
  on public.members for update to authenticated
  using (public.is_family_parent(family_id))
  with check (public.is_family_parent(family_id));

-- A parent cannot remove their own member row (would lock the family out).
create policy "parents can remove other members"
  on public.members for delete to authenticated
  using (public.is_family_parent(family_id) and user_id is distinct from (select auth.uid()));

create policy "family members can read shopping items"
  on public.shopping_items for select to authenticated
  using (public.is_family_member(family_id));

create policy "family members can add shopping items"
  on public.shopping_items for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and (
      added_by is null
      or exists (
        select 1 from public.members m
        where m.id = added_by and m.family_id = shopping_items.family_id
      )
    )
  );

create policy "family members can update shopping items"
  on public.shopping_items for update to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy "family members can delete shopping items"
  on public.shopping_items for delete to authenticated
  using (public.is_family_member(family_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.shopping_items;
alter publication supabase_realtime add table public.members;
