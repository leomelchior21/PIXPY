-- PixPy teacher live view over Supabase Realtime.
--
-- Supersedes the polling-only design in 20260919090000_pixpy_live_code.sql:
--  * the live table moves to the public schema (Realtime Postgres Changes only
--    streams public tables),
--  * display_name / class_name / group_name are denormalized so every realtime
--    payload is self-contained,
--  * one teacher Supabase Auth user (email leleomaker@pixpy.local) gets a JWT,
--    claims a row in private.pixpy_teachers and subscribes with RLS scoped to
--    that identity. Students never receive realtime data: they keep publishing
--    through the SECURITY DEFINER RPC, which bypasses RLS as the table owner.
--
-- Safe to re-run. Student progress lives in private.pixpy_students.progress and
-- is never touched by this migration; existing live rows are copied over so
-- nothing already published is lost.

create table if not exists public.pixpy_live_code (
  username text primary key references private.pixpy_students (username) on delete cascade,
  display_name text not null default '',
  class_name text,
  group_name text,
  module text not null default 'stop',
  detail text,
  code text not null default '',
  updated_at timestamptz not null default now()
);

-- Preserve any rows written before this migration (the old private table).
do $$
begin
  if to_regclass('private.pixpy_live_code') is not null then
    insert into public.pixpy_live_code (username, display_name, class_name, group_name, module, detail, code, updated_at)
    select code.username, student.display_name, student.class_name, student.group_name, code.module, code.detail, code.code, code.updated_at
    from private.pixpy_live_code code
    join private.pixpy_students student on student.username = code.username
    on conflict (username) do update
      set display_name = excluded.display_name,
          class_name = excluded.class_name,
          group_name = excluded.group_name,
          module = excluded.module,
          detail = excluded.detail,
          code = excluded.code,
          updated_at = excluded.updated_at;
    drop table private.pixpy_live_code;
  end if;
end $$;

create index if not exists pixpy_live_code_updated_idx on public.pixpy_live_code (updated_at desc);

-- Teacher identities allowed to read every live row.
create table if not exists private.pixpy_teachers (
  auth_user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

revoke all on table private.pixpy_teachers from public, anon, authenticated;

alter table public.pixpy_live_code enable row level security;
revoke all on table public.pixpy_live_code from public, anon;

-- RLS helper: is the caller's JWT bound to a claimed teacher identity? Defined
-- before the policy that uses it. Superseded by the username claim migration,
-- which drops and recreates both this function's consumer and the claim RPC.
create or replace function public.pixpy_is_live_teacher()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from private.pixpy_teachers where auth_user_id = auth.uid()
  )
$$;

-- Only the teacher role can SELECT the table directly or over Realtime. The
-- publish RPC below is SECURITY DEFINER, so students never need grants.
drop policy if exists pixpy_live_code_teacher_read on public.pixpy_live_code;
create policy pixpy_live_code_teacher_read on public.pixpy_live_code
  for select to authenticated
  using (public.pixpy_is_live_teacher());

grant select on public.pixpy_live_code to authenticated;

-- Called by the teacher live page right after sign-in. The JWT email is the
-- boundary; the account is created once (dashboard or setup script).
create or replace function public.pixpy_claim_live_teacher()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if pg_catalog.lower(pg_catalog.coalesce(auth.jwt() ->> 'email', '')) <> 'leleomaker@pixpy.local' then
    raise exception 'Teacher access required';
  end if;
  insert into private.pixpy_teachers (auth_user_id)
  values (auth.uid())
  on conflict (auth_user_id) do nothing;
  return true;
end;
$$;

-- Students publish their own row (username hash gate), now with the roster
-- fields denormalized for Realtime payloads. Unchanged signatures keep the
-- existing client compatible.
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

-- Initial load and polling fallback for the teacher page.
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
        'display_name', code.display_name,
        'class_name', code.class_name,
        'group_name', code.group_name,
        'module', code.module,
        'detail', code.detail,
        'code', code.code,
        'updated_at', code.updated_at
      )
      order by code.class_name nulls last, code.group_name nulls last, code.display_name
    ),
    '[]'::jsonb
  ) into result
  from public.pixpy_live_code code
  where p_after is null or code.updated_at > p_after;

  return result;
end;
$$;

revoke all on function public.pixpy_claim_live_teacher() from public, anon;
revoke all on function public.pixpy_is_live_teacher() from public, anon;
revoke all on function public.pixpy_publish_live_code(text, text, text, text) from public;
revoke all on function public.pixpy_live_code(text, timestamptz) from public;

grant execute on function public.pixpy_claim_live_teacher() to authenticated;
grant execute on function public.pixpy_is_live_teacher() to authenticated;
grant execute on function public.pixpy_publish_live_code(text, text, text, text) to anon, authenticated;
grant execute on function public.pixpy_live_code(text, timestamptz) to anon, authenticated;

-- Stream every change of the live table to authorized subscribers.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pixpy_live_code'
  ) then
    alter publication supabase_realtime add table public.pixpy_live_code;
  end if;
end $$;

-- Verification:
--   1. As an anonymous/student client, `select * from public.pixpy_live_code`
--      returns nothing (no grant, RLS denies) - no cross-student reads.
--   2. As any non-teacher auth user, `public.pixpy_claim_live_teacher()`
--      raises "Teacher access required".
--   3. As the teacher account, subscribing to postgres_changes on
--      public.pixpy_live_code receives events for every student.
