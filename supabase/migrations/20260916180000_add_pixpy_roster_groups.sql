alter table private.pixpy_students
  add column if not exists class_name text check (class_name in ('A', 'B', 'C')),
  add column if not exists group_name text check (group_name in ('white', 'yellow'));

create or replace function private.pixpy_seed_student(
  p_username text,
  p_display_name text,
  p_class_name text,
  p_group_name text default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  normalized text;
  clean_class text;
  clean_group text;
begin
  normalized := pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(p_username, ''))), '[^a-z0-9]', '', 'g');
  clean_class := pg_catalog.upper(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_class_name, '')), '^7', ''));
  clean_group := pg_catalog.lower(pg_catalog.nullif(pg_catalog.btrim(coalesce(p_group_name, '')), ''));

  if normalized !~ '^[a-z0-9]{3,40}$'
    or length(pg_catalog.btrim(coalesce(p_display_name, ''))) not between 2 and 60
    or clean_class not in ('A', 'B', 'C')
    or (clean_group is not null and clean_group not in ('white', 'yellow')) then
    raise exception 'Invalid roster entry';
  end if;

  insert into private.pixpy_students (username, username_hash, display_name, class_name, group_name)
  values (
    normalized,
    pg_catalog.encode(extensions.digest(normalized, 'sha256'), 'hex'),
    pg_catalog.btrim(p_display_name),
    clean_class,
    clean_group
  )
  on conflict (username_hash) do update
    set username = excluded.username,
        display_name = excluded.display_name,
        class_name = excluded.class_name,
        group_name = excluded.group_name;
end;
$$;

revoke all on function private.pixpy_seed_student(text, text, text, text) from public, anon, authenticated;

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
        'class_name', class_name,
        'group_name', group_name,
        'progress', progress,
        'updated_at', updated_at,
        'last_login_at', last_login_at
      ) order by class_name nulls last, group_name nulls last, display_name
    ),
    '[]'::jsonb
  ) into result
  from private.pixpy_students;

  return result;
end;
$$;

-- Temporary batch entry point used to attach the private PDF metadata after
-- this migration is deployed. It is removed in the following migration.
create or replace function public.pixpy_seed_roster_groups(p_teacher_username text, p_students jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  seeded integer := 0;
begin
  if pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(p_teacher_username, ''))), '[^a-z0-9]', '', 'g') <> 'leleomaker'
    or pg_catalog.jsonb_typeof(p_students) <> 'array'
    or pg_catalog.jsonb_array_length(p_students) > 200 then
    raise exception 'Teacher access required';
  end if;

  for item in select value from pg_catalog.jsonb_array_elements(p_students)
  loop
    perform private.pixpy_seed_student(
      item ->> 'username',
      item ->> 'display_name',
      item ->> 'class_name',
      item ->> 'group_name'
    );
    seeded := seeded + 1;
  end loop;

  return seeded;
end;
$$;

revoke all on function public.pixpy_class_progress(text) from public;
revoke all on function public.pixpy_seed_roster_groups(text, jsonb) from public;
grant execute on function public.pixpy_class_progress(text) to anon, authenticated;
grant execute on function public.pixpy_seed_roster_groups(text, jsonb) to anon;
