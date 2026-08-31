-- PixPy classroom core
-- Run this file in the Supabase SQL editor, then run the locally generated roster seed.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create schema if not exists private;

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  login_hash bytea not null unique,
  display_name text not null check (char_length(display_name) between 1 and 60),
  class_id uuid references public.classes(id) on delete set null,
  avatar_id text,
  xp integer not null default 0 check (xp >= 0),
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now()
);

create table if not exists public.experiences (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  concept text not null,
  sort_order integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.student_experience_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  experience_id uuid not null references public.experiences(id) on delete cascade,
  progress integer not null default 0 check (progress between 0 and 100),
  completed boolean not null default false,
  completed_missions text[] not null default '{}',
  run_count integer not null default 0,
  hints_used integer not null default 0,
  last_code text,
  last_config jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (student_id, experience_id)
);

create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon text not null
);

create table if not exists public.student_badges (
  student_id uuid not null references public.students(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (student_id, badge_id)
);

create table if not exists private.student_sessions (
  token uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '12 hours'
);

create index if not exists student_sessions_student_idx on private.student_sessions(student_id);
create index if not exists student_sessions_expiry_idx on private.student_sessions(expires_at);
create index if not exists progress_student_idx on public.student_experience_progress(student_id);

insert into public.experiences (slug, title, concept, sort_order)
values ('dino-lab', 'Dino Lab', 'Variables', 1)
on conflict (slug) do update set title = excluded.title, concept = excluded.concept, sort_order = excluded.sort_order;

insert into public.badges (slug, name, description, icon)
values
  ('first-run', 'First Signal', 'Ran Python for the first time', 'zap'),
  ('experimenter', 'Experimenter', 'Tried several different modes', 'sparkles'),
  ('chaos-engineer', 'Chaos Engineer', 'Created an extreme configuration', 'award'),
  ('lab-survivor', 'Lab Survivor', 'Completed every Dino Lab mission', 'shield')
on conflict (slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon;

alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.experiences enable row level security;
alter table public.student_experience_progress enable row level security;
alter table public.badges enable row level security;
alter table public.student_badges enable row level security;

revoke all on public.classes from anon, authenticated;
revoke all on public.students from anon, authenticated;
revoke all on public.experiences from anon, authenticated;
revoke all on public.student_experience_progress from anon, authenticated;
revoke all on public.badges from anon, authenticated;
revoke all on public.student_badges from anon, authenticated;
revoke all on private.student_sessions from public, anon, authenticated;
revoke usage on schema private from public, anon, authenticated;

create or replace function private.canonical_access_id(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, public, extensions
as $$
  select regexp_replace(lower(extensions.unaccent(coalesce(p_value, ''))), '[^a-z0-9]', '', 'g');
$$;

create or replace function private.valid_student_for_token(p_token uuid)
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, private, extensions
as $$
  select student_id
  from private.student_sessions
  where token = p_token and expires_at > now();
$$;

-- This helper is intentionally private. The generated roster seed calls it only
-- from the SQL editor. Access IDs are stored as one-way hashes.
create or replace function private.pixpy_seed_student(
  p_access_id text,
  p_display_name text,
  p_class_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_hash bytea;
  v_class_id uuid;
  v_student_id uuid;
begin
  if char_length(private.canonical_access_id(p_access_id)) < 3 then
    raise exception 'Access ID is too short';
  end if;

  v_hash := extensions.digest(convert_to(private.canonical_access_id(p_access_id), 'UTF8'), 'sha256');

  if nullif(trim(p_class_name), '') is not null then
    insert into public.classes(name) values (trim(p_class_name))
    on conflict (name) do update set name = excluded.name
    returning id into v_class_id;
  end if;

  insert into public.students(login_hash, display_name, class_id)
  values (v_hash, trim(p_display_name), v_class_id)
  on conflict (login_hash) do update
  set display_name = excluded.display_name,
      class_id = coalesce(excluded.class_id, public.students.class_id)
  returning id into v_student_id;

  return v_student_id;
end;
$$;

revoke all on function private.pixpy_seed_student(text, text, text) from public, anon, authenticated;
revoke all on function private.canonical_access_id(text) from public, anon, authenticated;
revoke all on function private.valid_student_for_token(uuid) from public, anon, authenticated;

create or replace function public.pixpy_identify_student(p_access_id text)
returns table (
  student_id uuid,
  display_name text,
  avatar_id text,
  xp integer,
  completed_missions text[],
  badges text[],
  session_token uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_student public.students%rowtype;
  v_token uuid;
begin
  if char_length(private.canonical_access_id(p_access_id)) < 3 then
    return;
  end if;

  select * into v_student
  from public.students
  where login_hash = extensions.digest(convert_to(private.canonical_access_id(p_access_id), 'UTF8'), 'sha256');

  if not found then return; end if;

  delete from private.student_sessions
  where student_id = v_student.id and expires_at <= now();

  insert into private.student_sessions(student_id)
  values (v_student.id)
  returning token into v_token;

  update public.students set last_active_at = now() where id = v_student.id;

  return query
  select
    v_student.id,
    v_student.display_name,
    v_student.avatar_id,
    v_student.xp,
    coalesce(p.completed_missions, '{}'::text[]),
    coalesce(array_agg(distinct b.slug) filter (where b.slug is not null), '{}'::text[]),
    v_token
  from (select 1) seed
  left join public.experiences e on e.slug = 'dino-lab'
  left join public.student_experience_progress p on p.student_id = v_student.id and p.experience_id = e.id
  left join public.student_badges sb on sb.student_id = v_student.id
  left join public.badges b on b.id = sb.badge_id
  group by p.completed_missions;
end;
$$;

create or replace function public.pixpy_update_avatar(p_session_token uuid, p_avatar_id text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare v_student_id uuid;
begin
  v_student_id := private.valid_student_for_token(p_session_token);
  if v_student_id is null then raise exception 'Session expired'; end if;
  if p_avatar_id not in ('nova', 'byte', 'echo', 'flux', 'moss', 'orbit') then
    raise exception 'Unknown avatar';
  end if;
  update public.students set avatar_id = p_avatar_id, last_active_at = now() where id = v_student_id;
end;
$$;

create or replace function public.pixpy_save_dino_progress(
  p_session_token uuid,
  p_code text,
  p_config jsonb,
  p_completed_missions text[]
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_student_id uuid;
  v_experience_id uuid;
  v_previous text[] := '{}'::text[];
  v_allowed text[] := array['super-speed','moon-mode','giant-mode','chaos-mode','survivor-mode'];
  v_completed text[];
  v_new text[];
  v_reward integer := 0;
begin
  v_student_id := private.valid_student_for_token(p_session_token);
  if v_student_id is null then raise exception 'Session expired'; end if;
  if char_length(coalesce(p_code, '')) > 4000 then raise exception 'Code is too long'; end if;
  if jsonb_typeof(coalesce(p_config, '{}'::jsonb)) <> 'object' then raise exception 'Invalid configuration'; end if;

  select id into v_experience_id from public.experiences where slug = 'dino-lab';
  select completed_missions into v_previous
  from public.student_experience_progress
  where student_id = v_student_id and experience_id = v_experience_id;
  v_previous := coalesce(v_previous, '{}'::text[]);

  select coalesce(array_agg(distinct item), '{}'::text[]) into v_completed
  from unnest(coalesce(p_completed_missions, '{}'::text[])) item
  where item = any(v_allowed);

  select coalesce(array_agg(item), '{}'::text[]) into v_new
  from unnest(v_completed) item
  where not (item = any(v_previous));

  select coalesce(sum(case item
    when 'super-speed' then 80 when 'moon-mode' then 90 when 'giant-mode' then 100
    when 'chaos-mode' then 110 when 'survivor-mode' then 120 else 0 end), 0)
  into v_reward from unnest(v_new) item;

  insert into public.student_experience_progress (
    student_id, experience_id, progress, completed, completed_missions,
    run_count, last_code, last_config, updated_at, completed_at
  ) values (
    v_student_id, v_experience_id, cardinality(v_completed) * 20,
    cardinality(v_completed) = 5, v_completed, 1, p_code, p_config, now(),
    case when cardinality(v_completed) = 5 then now() else null end
  )
  on conflict (student_id, experience_id) do update set
    progress = excluded.progress,
    completed = excluded.completed,
    completed_missions = excluded.completed_missions,
    run_count = public.student_experience_progress.run_count + 1,
    last_code = excluded.last_code,
    last_config = excluded.last_config,
    updated_at = now(),
    completed_at = coalesce(public.student_experience_progress.completed_at, excluded.completed_at);

  update public.students set xp = xp + v_reward, last_active_at = now() where id = v_student_id;

  insert into public.student_badges(student_id, badge_id)
  select v_student_id, id from public.badges where slug = 'first-run'
  on conflict do nothing;

  if cardinality(v_completed) >= 3 then
    insert into public.student_badges(student_id, badge_id)
    select v_student_id, id from public.badges where slug = 'experimenter'
    on conflict do nothing;
  end if;
  if 'chaos-mode' = any(v_completed) then
    insert into public.student_badges(student_id, badge_id)
    select v_student_id, id from public.badges where slug = 'chaos-engineer'
    on conflict do nothing;
  end if;
  if cardinality(v_completed) = 5 then
    insert into public.student_badges(student_id, badge_id)
    select v_student_id, id from public.badges where slug = 'lab-survivor'
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.pixpy_get_ranking(p_session_token uuid)
returns table (
  rank bigint,
  display_name text,
  avatar_id text,
  xp integer,
  progress integer,
  badges bigint,
  is_current boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare v_student_id uuid; v_class_id uuid;
begin
  v_student_id := private.valid_student_for_token(p_session_token);
  if v_student_id is null then raise exception 'Session expired'; end if;
  select class_id into v_class_id from public.students where id = v_student_id;

  return query
  select
    row_number() over (order by s.xp desc, s.created_at asc),
    s.display_name,
    coalesce(s.avatar_id, 'nova'),
    s.xp,
    coalesce(p.progress, 0),
    count(distinct sb.badge_id),
    s.id = v_student_id
  from public.students s
  left join public.experiences e on e.slug = 'dino-lab'
  left join public.student_experience_progress p on p.student_id = s.id and p.experience_id = e.id
  left join public.student_badges sb on sb.student_id = s.id
  where v_class_id is null or s.class_id = v_class_id
  group by s.id, p.progress
  order by s.xp desc, s.created_at asc
  limit 40;
end;
$$;

revoke all on function public.pixpy_identify_student(text) from public;
revoke all on function public.pixpy_update_avatar(uuid, text) from public;
revoke all on function public.pixpy_save_dino_progress(uuid, text, jsonb, text[]) from public;
revoke all on function public.pixpy_get_ranking(uuid) from public;
grant execute on function public.pixpy_identify_student(text) to anon, authenticated;
grant execute on function public.pixpy_update_avatar(uuid, text) to anon, authenticated;
grant execute on function public.pixpy_save_dino_progress(uuid, text, jsonb, text[]) to anon, authenticated;
grant execute on function public.pixpy_get_ranking(uuid) to anon, authenticated;
