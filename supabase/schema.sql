create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  default_setlist_id uuid null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.setlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  event_date date null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.setlist_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  setlist_id uuid not null references public.setlists (id) on delete cascade,
  position integer not null check (position >= 0),
  title text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.practice_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_date date not null,
  event_time time not null,
  type text not null check (type in ('rehearsal', 'gig', 'recording', 'other')),
  custom_label text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.gig_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  details text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.stage_plot_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  role text not null default '',
  type text not null check (type in ('member', 'gear')),
  x numeric(5,2) not null default 50,
  y numeric(5,2) not null default 50,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists setlists_user_id_idx on public.setlists (user_id);
create index if not exists setlist_songs_user_id_idx on public.setlist_songs (user_id);
create index if not exists setlist_songs_setlist_id_position_idx on public.setlist_songs (setlist_id, position);
create index if not exists practice_events_user_id_idx on public.practice_events (user_id);
create index if not exists gig_notes_user_id_idx on public.gig_notes (user_id);
create index if not exists stage_plot_items_user_id_idx on public.stage_plot_items (user_id);

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_default_setlist_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_default_setlist_id_fkey
      foreign key (default_setlist_id)
      references public.setlists (id)
      on delete set null;
  end if;
end;
$$;

create or replace trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace trigger set_setlists_updated_at
before update on public.setlists
for each row
execute function public.set_updated_at();

create or replace trigger set_practice_events_updated_at
before update on public.practice_events
for each row
execute function public.set_updated_at();

create or replace trigger set_gig_notes_updated_at
before update on public.gig_notes
for each row
execute function public.set_updated_at();

create or replace trigger set_stage_plot_items_updated_at
before update on public.stage_plot_items
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.setlists enable row level security;
alter table public.setlist_songs enable row level security;
alter table public.practice_events enable row level security;
alter table public.gig_notes enable row level security;
alter table public.stage_plot_items enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "setlists_manage_own" on public.setlists;
create policy "setlists_manage_own"
on public.setlists
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "setlist_songs_manage_own" on public.setlist_songs;
create policy "setlist_songs_manage_own"
on public.setlist_songs
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "practice_events_manage_own" on public.practice_events;
create policy "practice_events_manage_own"
on public.practice_events
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "gig_notes_manage_own" on public.gig_notes;
create policy "gig_notes_manage_own"
on public.gig_notes
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "stage_plot_items_manage_own" on public.stage_plot_items;
create policy "stage_plot_items_manage_own"
on public.stage_plot_items
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', '')
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create or replace function public.get_user_workspace()
returns jsonb
language sql
security invoker
set search_path = public
as $$
  with current_profile as (
    select p.*
    from public.profiles p
    where p.id = auth.uid()
  ),
  current_setlists as (
    select
      s.id,
      s.name,
      s.event_date,
      s.created_at,
      coalesce(
        jsonb_agg(song.title order by song.position)
          filter (where song.id is not null),
        '[]'::jsonb
      ) as songs
    from public.setlists s
    left join public.setlist_songs song on song.setlist_id = s.id
    where s.user_id = auth.uid()
    group by s.id, s.name, s.event_date, s.created_at
    order by s.created_at desc
  ),
  current_gig_notes as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', note.id,
          'title', note.title,
          'details', note.details
        )
        order by note.created_at desc
      ),
      '[]'::jsonb
    ) as items
    from public.gig_notes note
    where note.user_id = auth.uid()
  ),
  current_practices as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', practice.id,
          'date', practice.event_date,
          'time', to_char(practice.event_time, 'HH24:MI'),
          'type', practice.type,
          'customLabel', practice.custom_label
        )
        order by practice.event_date, practice.event_time
      ),
      '[]'::jsonb
    ) as items
    from public.practice_events practice
    where practice.user_id = auth.uid()
  ),
  current_stage_items as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', stage.id,
          'name', stage.name,
          'role', stage.role,
          'type', stage.type,
          'x', stage.x,
          'y', stage.y
        )
        order by stage.created_at
      ),
      '[]'::jsonb
    ) as items
    from public.stage_plot_items stage
    where stage.user_id = auth.uid()
  )
  select
    case
      when auth.uid() is null then null
      when not exists (select 1 from current_profile)
        and not exists (select 1 from public.setlists where user_id = auth.uid())
        and not exists (select 1 from public.gig_notes where user_id = auth.uid())
        and not exists (select 1 from public.practice_events where user_id = auth.uid())
        and not exists (select 1 from public.stage_plot_items where user_id = auth.uid())
      then null
      else jsonb_build_object(
        'profile',
        jsonb_build_object(
          'displayName',
          coalesce((select display_name from current_profile limit 1), '')
        ),
        'defaultSetlistId',
        (select default_setlist_id from current_profile limit 1),
        'setlists',
        coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'id', setlist.id,
                'name', setlist.name,
                'date', setlist.event_date,
                'songs', setlist.songs
              )
              order by setlist.created_at desc
            )
            from current_setlists setlist
          ),
          '[]'::jsonb
        ),
        'gigNotes',
        (select items from current_gig_notes),
        'practices',
        (select items from current_practices),
        'stageItems',
        (select items from current_stage_items)
      )
    end;
$$;

create or replace function public.save_user_workspace(workspace jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  setlist jsonb;
  song text;
  song_position integer;
  note jsonb;
  practice jsonb;
  stage_item jsonb;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id, display_name, default_setlist_id)
  values (
    current_user_id,
    coalesce(workspace->'profile'->>'displayName', ''),
    null
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        default_setlist_id = null,
        updated_at = timezone('utc', now());

  delete from public.setlist_songs where user_id = current_user_id;
  delete from public.setlists where user_id = current_user_id;
  delete from public.practice_events where user_id = current_user_id;
  delete from public.gig_notes where user_id = current_user_id;
  delete from public.stage_plot_items where user_id = current_user_id;

  for setlist in
    select value
    from jsonb_array_elements(coalesce(workspace->'setlists', '[]'::jsonb))
  loop
    insert into public.setlists (id, user_id, name, event_date)
    values (
      (setlist->>'id')::uuid,
      current_user_id,
      coalesce(setlist->>'name', ''),
      nullif(setlist->>'date', '')::date
    );

    song_position := 0;
    for song in
      select value #>> '{}'
      from jsonb_array_elements(coalesce(setlist->'songs', '[]'::jsonb))
    loop
      insert into public.setlist_songs (user_id, setlist_id, position, title)
      values (
        current_user_id,
        (setlist->>'id')::uuid,
        song_position,
        song
      );
      song_position := song_position + 1;
    end loop;
  end loop;

  for note in
    select value
    from jsonb_array_elements(coalesce(workspace->'gigNotes', '[]'::jsonb))
  loop
    insert into public.gig_notes (id, user_id, title, details)
    values (
      (note->>'id')::uuid,
      current_user_id,
      coalesce(note->>'title', ''),
      coalesce(note->>'details', '')
    );
  end loop;

  for practice in
    select value
    from jsonb_array_elements(coalesce(workspace->'practices', '[]'::jsonb))
  loop
    insert into public.practice_events (id, user_id, event_date, event_time, type, custom_label)
    values (
      (practice->>'id')::uuid,
      current_user_id,
      (practice->>'date')::date,
      (practice->>'time')::time,
      coalesce(practice->>'type', 'other'),
      coalesce(practice->>'customLabel', '')
    );
  end loop;

  for stage_item in
    select value
    from jsonb_array_elements(coalesce(workspace->'stageItems', '[]'::jsonb))
  loop
    insert into public.stage_plot_items (id, user_id, name, role, type, x, y)
    values (
      (stage_item->>'id')::uuid,
      current_user_id,
      coalesce(stage_item->>'name', ''),
      coalesce(stage_item->>'role', ''),
      coalesce(stage_item->>'type', 'member'),
      coalesce((stage_item->>'x')::numeric, 50),
      coalesce((stage_item->>'y')::numeric, 50)
    );
  end loop;

  update public.profiles
  set default_setlist_id = nullif(workspace->>'defaultSetlistId', '')::uuid,
      updated_at = timezone('utc', now())
  where id = current_user_id;
end;
$$;
