alter table private.pixpy_students
  drop constraint pixpy_students_group_name_check,
  add constraint pixpy_students_group_name_check
    check (group_name in ('white', 'yellow', 'external')),
  add constraint pixpy_students_external_class_check
    check (group_name is distinct from 'external' or class_name is null);

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
  clean_class := nullif(pg_catalog.upper(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_class_name, '')), '^7', '')), '');
  clean_group := pg_catalog.lower(nullif(pg_catalog.btrim(coalesce(p_group_name, '')), ''));

  if normalized !~ '^[a-z0-9]{3,40}$'
    or length(pg_catalog.btrim(coalesce(p_display_name, ''))) not between 2 and 60
    or (clean_group = 'external' and clean_class is not null)
    or (clean_group is distinct from 'external' and (clean_class is null or clean_class not in ('A', 'B', 'C')))
    or (clean_group is not null and clean_group not in ('white', 'yellow', 'external')) then
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
