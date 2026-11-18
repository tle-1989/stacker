begin;

create table if not exists public.stacker_scores (
  player_id uuid primary key,
  player_name text not null check (char_length(player_name) between 1 and 24),
  score integer not null check (score > 0),
  achieved_at timestamptz not null default now()
);

alter table public.stacker_scores enable row level security;
revoke all on public.stacker_scores from public, anon, authenticated;
create index if not exists stacker_scores_rank
  on public.stacker_scores (score desc, achieved_at, player_id);

create or replace function public.stacker_top_scores()
returns table (player_name text, score integer)
language sql stable security definer set search_path = ''
as $$
  select s.player_name, s.score
  from public.stacker_scores as s
  order by s.score desc, s.achieved_at, s.player_id
  limit 3;
$$;

create or replace function public.stacker_submit_score(
  p_player_id uuid, p_player_name text, p_score integer
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.stacker_scores (player_id, player_name, score)
  values (p_player_id, btrim(p_player_name), p_score)
  on conflict (player_id) do update
    set score = excluded.score,
        player_name = excluded.player_name,
        achieved_at = excluded.achieved_at
    where excluded.score > stacker_scores.score;
$$;

revoke all on function public.stacker_top_scores() from public;
revoke all on function public.stacker_submit_score(uuid, text, integer) from public;
grant execute on function public.stacker_top_scores() to anon, authenticated;
grant execute on function public.stacker_submit_score(uuid, text, integer) to anon, authenticated;

commit;
