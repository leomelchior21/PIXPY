create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create extension if not exists pgcrypto with schema extensions;

create table if not exists private.pixpy_students (
  id bigint generated always as identity primary key,
  username text not null unique check (username ~ '^[a-z0-9]{3,40}$'),
  username_hash text not null unique check (length(username_hash) = 64),
  display_name text not null check (length(display_name) between 2 and 60),
  progress jsonb,
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  updated_at timestamptz
);

alter table private.pixpy_students enable row level security;
revoke all on table private.pixpy_students from public, anon, authenticated;

create or replace function public.pixpy_login(p_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
  student private.pixpy_students%rowtype;
begin
  normalized := pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(p_username, ''))), '[^a-z0-9]', '', 'g');

  if normalized = 'leleomaker' then
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'username', 'leleomaker',
      'display_name', 'Leo',
      'is_teacher', true,
      'progress', null
    );
  end if;

  select * into student
  from private.pixpy_students
  where username_hash = pg_catalog.encode(extensions.digest(normalized, 'sha256'), 'hex');

  if not found then
    return pg_catalog.jsonb_build_object('ok', false);
  end if;

  update private.pixpy_students
  set last_login_at = pg_catalog.now()
  where id = student.id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'username', student.username,
    'display_name', student.display_name,
    'is_teacher', false,
    'progress', student.progress
  );
end;
$$;

create or replace function public.pixpy_save_progress(p_username text, p_progress jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
  changed integer;
begin
  normalized := pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(p_username, ''))), '[^a-z0-9]', '', 'g');

  if p_progress is null
    or pg_catalog.jsonb_typeof(p_progress) <> 'object'
    or pg_catalog.pg_column_size(p_progress) > 200000 then
    return false;
  end if;

  update private.pixpy_students
  set progress = p_progress,
      updated_at = pg_catalog.now()
  where username_hash = pg_catalog.encode(extensions.digest(normalized, 'sha256'), 'hex');

  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.pixpy_class_progress(p_teacher_username text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
  result jsonb;
begin
  normalized := pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(p_teacher_username, ''))), '[^a-z0-9]', '', 'g');
  if normalized <> 'leleomaker' then
    raise exception 'Teacher access required';
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'username', username,
        'display_name', display_name,
        'progress', progress,
        'updated_at', updated_at,
        'last_login_at', last_login_at
      ) order by display_name
    ),
    '[]'::jsonb
  ) into result
  from private.pixpy_students;

  return result;
end;
$$;

-- This one-time setup function is removed by the next migration after the
-- private roster has been loaded. Roster names never need to live in Git.
create or replace function public.pixpy_seed_roster(p_students jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  normalized text;
  label text;
  seeded integer := 0;
begin
  if pg_catalog.jsonb_typeof(p_students) <> 'array' then
    raise exception 'Roster must be a JSON array';
  end if;

  for item in select value from pg_catalog.jsonb_array_elements(p_students)
  loop
    normalized := pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(item ->> 'username', ''))), '[^a-z0-9]', '', 'g');
    label := pg_catalog.btrim(coalesce(item ->> 'display_name', ''));

    if normalized !~ '^[a-z0-9]{3,40}$' or length(label) not between 2 and 60 then
      raise exception 'Invalid roster entry';
    end if;

    insert into private.pixpy_students (username, username_hash, display_name)
    values (normalized, pg_catalog.encode(extensions.digest(normalized, 'sha256'), 'hex'), label)
    on conflict (username_hash) do update
      set username = excluded.username,
          display_name = excluded.display_name;
    seeded := seeded + 1;
  end loop;

  return seeded;
end;
$$;

revoke all on function public.pixpy_login(text) from public;
revoke all on function public.pixpy_save_progress(text, jsonb) from public;
revoke all on function public.pixpy_class_progress(text) from public;
revoke all on function public.pixpy_seed_roster(jsonb) from public;

grant execute on function public.pixpy_login(text) to anon, authenticated;
grant execute on function public.pixpy_save_progress(text, jsonb) to anon, authenticated;
grant execute on function public.pixpy_class_progress(text) to anon, authenticated;
grant execute on function public.pixpy_seed_roster(jsonb) to anon;
