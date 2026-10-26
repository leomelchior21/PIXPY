-- Only game scores are returned; the rest of each student's progress stays private.
create or replace function public.pixpy_backroom_scores()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'username', username, 'name', display_name, 'gates', gates, 'xp', xp
  ) order by gates desc, xp desc, display_name), '[]'::jsonb)
  from (
    select username, display_name,
      case when progress ->> 'backroomRunBest' ~ '^[0-9]{1,9}$'
        then (progress ->> 'backroomRunBest')::integer else 0 end as gates,
      case when progress ->> 'backroomRunXp' ~ '^[0-9]{1,9}$'
        then (progress ->> 'backroomRunXp')::integer else 0 end as xp
    from private.pixpy_students
    where case when progress ->> 'backroomRunBest' ~ '^[0-9]{1,9}$'
      then (progress ->> 'backroomRunBest')::integer else 0 end > 0
    order by gates desc, xp desc, display_name
    limit 20
  ) as scores;
$$;

revoke all on function public.pixpy_backroom_scores() from public;
grant execute on function public.pixpy_backroom_scores() to anon, authenticated;
