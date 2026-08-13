-- Public leaderboard/profile views evaluate this immutable helper as the
-- requesting PostgREST role. Allow only the roles that can read those views.
grant execute on function public.ranked_base_tier(integer) to anon, authenticated;
