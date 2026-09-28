-- Passwordless realtime unlock.
--
-- PixPy signs the teacher in with the username "leleomaker" only, so the live
-- view must not require a second credential. The live page signs in anonymously
-- (Authentication -> Sign In / Providers -> Anonymous sign-ins must be enabled)
-- and claims the teacher identity through this function. That is the same trust
-- level the app already uses for teacher mode: whoever knows the teacher
-- username can open the dashboard, so the claim check is the username too.
-- Students still cannot read other rows: only uids present in
-- private.pixpy_teachers pass the RLS policy, and only the teacher username can
-- be claimed.

drop function if exists public.pixpy_claim_live_teacher();

create or replace function public.pixpy_claim_live_teacher(p_username text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := pg_catalog.regexp_replace(pg_catalog.lower(pg_catalog.btrim(coalesce(p_username, ''))), '[^a-z0-9]', '', 'g');

  if auth.uid() is null or normalized <> 'leleomaker' then
    return false;
  end if;

  insert into private.pixpy_teachers (auth_user_id)
  values (auth.uid())
  on conflict (auth_user_id) do nothing;

  return true;
end;
$$;

revoke all on function public.pixpy_claim_live_teacher(text) from public, anon;
grant execute on function public.pixpy_claim_live_teacher(text) to authenticated;
