-- Saving identical progress no longer rewrites the row: each rewrite costs disk IO on the
-- shared Nano instance, and retries or old open tabs can send the same snapshot again.
create or replace function public.pixpy_save_progress(p_username text, p_progress jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
  hashed text;
  changed integer;
begin
  normalized := pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(p_username, ''))), '[^a-z0-9]', '', 'g');

  if p_progress is null
    or pg_catalog.jsonb_typeof(p_progress) <> 'object'
    or pg_catalog.pg_column_size(p_progress) > 200000 then
    return false;
  end if;

  hashed := pg_catalog.encode(extensions.digest(normalized, 'sha256'), 'hex');

  update private.pixpy_students
  set progress = p_progress,
      updated_at = pg_catalog.now()
  where username_hash = hashed
    and progress is distinct from p_progress;

  get diagnostics changed = row_count;
  if changed = 1 then
    return true;
  end if;
  return exists (select 1 from private.pixpy_students where username_hash = hashed);
end;
$$;

revoke all on function public.pixpy_save_progress(text, jsonb) from public;
grant execute on function public.pixpy_save_progress(text, jsonb) to anon, authenticated;
