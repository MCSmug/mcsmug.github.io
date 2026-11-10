-- Tasks (one-off and recurring) and their completions (also the kids' stars).

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  assignee_id uuid not null references public.members (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  -- Key of a picture shown in the kids' mode (see src/lib/taskIcons.ts).
  icon text,
  -- One-off tasks: the day they are due. Recurring tasks: the first day.
  due_date date not null default current_date,
  -- Subset of RFC 5545: FREQ=DAILY or FREQ=WEEKLY;BYDAY=MO,TU,...
  recurrence text check (
    recurrence is null
    or recurrence = 'FREQ=DAILY'
    or recurrence ~ '^FREQ=WEEKLY;BYDAY=(MO|TU|WE|TH|FR|SA|SU)(,(MO|TU|WE|TH|FR|SA|SU))*$'
  ),
  -- Only used for one-off tasks; recurring tasks are tracked per day below.
  done_at timestamptz,
  is_kid_task boolean not null default false,
  created_at timestamptz not null default now()
);

create index tasks_family_idx on public.tasks (family_id);

-- One row per task and day it was done. Rows of kid tasks are the stars.
create table public.task_completions (
  task_id uuid not null references public.tasks (id) on delete cascade,
  day date not null,
  -- Who did it (the assignee at that time); keeps stars when a task is reassigned.
  member_id uuid not null references public.members (id) on delete cascade,
  is_kid_task boolean not null default false,
  completed_at timestamptz not null default now(),
  primary key (task_id, day)
);

create index task_completions_member_idx on public.task_completions (member_id);

revoke all on public.tasks, public.task_completions from anon, authenticated;
grant select, delete on public.tasks to authenticated;
grant insert (id, family_id, assignee_id, title, icon, due_date, recurrence, is_kid_task) on public.tasks to authenticated;
grant update (assignee_id, title, icon, due_date, recurrence, is_kid_task) on public.tasks to authenticated;
-- Completions are written only through set_task_done().
grant select on public.task_completions to authenticated;

alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;

create policy "family members can read tasks"
  on public.tasks for select to authenticated
  using (public.is_family_member(family_id));

create policy "family members can add tasks"
  on public.tasks for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and exists (
      select 1 from public.members m
      where m.id = assignee_id and m.family_id = tasks.family_id
    )
  );

create policy "family members can update tasks"
  on public.tasks for update to authenticated
  using (public.is_family_member(family_id))
  with check (
    public.is_family_member(family_id)
    and exists (
      select 1 from public.members m
      where m.id = assignee_id and m.family_id = tasks.family_id
    )
  );

create policy "family members can delete tasks"
  on public.tasks for delete to authenticated
  using (public.is_family_member(family_id));

create policy "family members can read task completions"
  on public.task_completions for select to authenticated
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_id and public.is_family_member(t.family_id)
    )
  );

-- Marks a task as done or not done for a day, in one transaction.
create function public.set_task_done(p_task_id uuid, p_day date, p_done boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t public.tasks%rowtype;
begin
  select * into t from public.tasks where id = p_task_id;
  if not found or not public.is_family_member(t.family_id) then
    raise exception 'task not found';
  end if;

  if p_done then
    insert into public.task_completions (task_id, day, member_id, is_kid_task)
    values (t.id, p_day, t.assignee_id, t.is_kid_task)
    on conflict (task_id, day) do nothing;
    if t.recurrence is null then
      update public.tasks set done_at = now() where id = t.id and done_at is null;
    end if;
  elsif t.recurrence is null then
    delete from public.task_completions where task_id = t.id;
    update public.tasks set done_at = null where id = t.id;
  else
    delete from public.task_completions where task_id = t.id and day = p_day;
  end if;
end;
$$;

revoke all on function public.set_task_done(uuid, date, boolean) from public, anon;
grant execute on function public.set_task_done(uuid, date, boolean) to authenticated;

alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_completions;
