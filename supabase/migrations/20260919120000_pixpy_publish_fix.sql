-- Fix: NULLIF/GREATEST-style constructs cannot be schema-qualified, so the
-- publish RPCs failed with "function pg_catalog.nullif(text, unknown) does not
-- exist" the first time a student published. Recreate the function with the
-- plain NULLIF expression. Idempotent and safe to re-run.

create or replace function public.pixpy_publish_live_code(
  p_username text,
  p_module text,
  p_detail text,
  p_code text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
  clean_module text;
  clean_detail text;
  clean_code text;
  student private.pixpy_students%rowtype;
begin
  normalized := pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(p_username, ''))), '[^a-z0-9]', '', 'g');
  clean_module := pg_catalog.left(pg_catalog.btrim(coalesce(p_module, 'stop')), 60);
  clean_detail := pg_catalog.left(pg_catalog.btrim(coalesce(p_detail, '')), 120);
  clean_code := pg_catalog.left(coalesce(p_code, ''), 20000);

  if normalized !~ '^[a-z0-9]{3,40}$' or clean_module = '' then
    return false;
  end if;

  select * into student
  from private.pixpy_students
  where username_hash = pg_catalog.encode(extensions.digest(normalized, 'sha256'), 'hex');

  if not found then
    return false;
  end if;

  insert into public.pixpy_live_code (username, display_name, class_name, group_name, module, detail, code, updated_at)
  values (student.username, student.display_name, student.class_name, student.group_name, clean_module, nullif(clean_detail, ''), clean_code, pg_catalog.now())
  on conflict (username) do update
    set display_name = excluded.display_name,
        class_name = excluded.class_name,
        group_name = excluded.group_name,
        module = excluded.module,
        detail = excluded.detail,
        code = excluded.code,
        updated_at = pg_catalog.now()
    where public.pixpy_live_code.code is distinct from excluded.code
       or public.pixpy_live_code.module is distinct from excluded.module
       or public.pixpy_live_code.detail is distinct from excluded.detail;

  return true;
end;
$$;

revoke all on function public.pixpy_publish_live_code(text, text, text, text) from public;
grant execute on function public.pixpy_publish_live_code(text, text, text, text) to anon, authenticated;
