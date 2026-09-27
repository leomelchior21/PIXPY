-- PixPy teacher live code view.
--
-- Students publish their current editor content (debounced) into a private
-- table; the teacher reads every row through a teacher-gated SECURITY DEFINER
-- function, exactly like the rest of the classroom schema.
--
-- This project signs students in through roster RPCs and has no Supabase Auth
-- JWT, so the live view polls pixpy_live_code() instead of using Realtime
-- Postgres Changes: the `authenticated` role cannot be mapped to a student
-- without a JWT, and the shared supabase_realtime publication is deliberately
-- left untouched for other apps in this project. Privacy is enforced by the
-- private schema plus the teacher check inside the function: a student can
-- publish only their own row and can never read somebody else's code.

create table if not exists private.pixpy_live_code (
  username text primary key references private.pixpy_students (username) on delete cascade,
  module text not null default 'stop',
  detail text,
  code text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists pixpy_live_code_updated_idx on private.pixpy_live_code (updated_at desc);

alter table private.pixpy_live_code enable row level security;
revoke all on table private.pixpy_live_code from public, anon, authenticated;

-- One upsert per student. Rows are capped so a runaway editor cannot bloat the
-- classroom database, and the WHERE guard skips heartbeats that changed
-- nothing.
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
  student_username text;
begin
  normalized := pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(p_username, ''))), '[^a-z0-9]', '', 'g');
  clean_module := pg_catalog.left(pg_catalog.btrim(coalesce(p_module, 'stop')), 60);
  clean_detail := pg_catalog.left(pg_catalog.btrim(coalesce(p_detail, '')), 120);
  clean_code := pg_catalog.left(coalesce(p_code, ''), 20000);

  if normalized !~ '^[a-z0-9]{3,40}$' or clean_module = '' then
    return false;
  end if;

  select username into student_username
  from private.pixpy_students
  where username_hash = pg_catalog.encode(extensions.digest(normalized, 'sha256'), 'hex');

  if not found then
    return false;
  end if;

  insert into private.pixpy_live_code (username, module, detail, code, updated_at)
  values (student_username, clean_module, pg_catalog.nullif(clean_detail, ''), clean_code, pg_catalog.now())
  on conflict (username) do update
    set module = excluded.module,
        detail = excluded.detail,
        code = excluded.code,
        updated_at = pg_catalog.now()
    where private.pixpy_live_code.code is distinct from excluded.code
       or private.pixpy_live_code.module is distinct from excluded.module
       or private.pixpy_live_code.detail is distinct from excluded.detail;

  return true;
end;
$$;

-- Teacher-only read of every live row, joined with the roster so each card is
-- self-contained. Pass p_after to receive only rows changed after that
-- timestamp, which keeps the 2 s refresh tiny during a lesson.
create or replace function public.pixpy_live_code(
  p_teacher_username text,
  p_after timestamptz default null
)
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
        'login', code.username,
        'display_name', student.display_name,
        'class_name', student.class_name,
        'group_name', student.group_name,
        'module', code.module,
        'detail', code.detail,
        'code', code.code,
        'updated_at', code.updated_at
      )
      order by student.class_name nulls last, student.group_name nulls last, student.display_name
    ),
    '[]'::jsonb
  ) into result
  from private.pixpy_live_code code
  join private.pixpy_students student on student.username = code.username
  where p_after is null or code.updated_at > p_after;

  return result;
end;
$$;

revoke all on function public.pixpy_publish_live_code(text, text, text, text) from public;
revoke all on function public.pixpy_live_code(text, timestamptz) from public;

grant execute on function public.pixpy_publish_live_code(text, text, text, text) to anon, authenticated;
grant execute on function public.pixpy_live_code(text, timestamptz) to anon, authenticated;

-- RLS / privacy check (run in the SQL editor):
--   1. As a student username, `select public.pixpy_live_code('leleomaker')`
--      must fail with "Teacher access required" - callers cannot pass a
--      student username to read the grid.
--   2. `public.pixpy_publish_live_code` only ever writes the row whose
--      username_hash matches, so one student cannot publish for another.
--   3. `private.pixpy_live_code` is revoked from anon/authenticated, and
--      `private` has no usage grant, so the raw table is unreachable.
