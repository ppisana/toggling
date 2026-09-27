-- Golf scoreboard on match results (match play "3 & 2" or stroke play "-4" to
-- par, reporter's choice) + auto-complete a tournament once its last match
-- is decided, instead of only checking on an explicit "advance round" call
-- that never happens for a single-match final round.

alter table public.matches
  add column score_type text check (score_type in ('match_play', 'stroke_play')),
  add column match_play_holes_up int check (match_play_holes_up between 1 and 9),
  add column match_play_holes_remaining int check (match_play_holes_remaining between 0 and 8),
  add column player1_score_to_par int,
  add column player2_score_to_par int,
  add constraint matches_score_shape_chk check (
    score_type is null
    or (
      score_type = 'match_play'
      and match_play_holes_up is not null
      and match_play_holes_remaining is not null
      and player1_score_to_par is null
      and player2_score_to_par is null
    )
    or (
      score_type = 'stroke_play'
      and player1_score_to_par is not null
      and player2_score_to_par is not null
      and match_play_holes_up is null
      and match_play_holes_remaining is null
    )
  );

-- =========================================================================
-- Auto-complete a tournament once its last outstanding round is decided
-- =========================================================================

create function public.maybe_complete_tournament(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tournament_id uuid;
  v_round int;
  v_match_count int;
  v_incomplete_count int;
begin
  select tournament_id, round into v_tournament_id, v_round
    from public.matches where id = p_match_id;

  select count(*), count(*) filter (where status not in ('completed', 'bye'))
    into v_match_count, v_incomplete_count
    from public.matches
    where tournament_id = v_tournament_id and round = v_round;

  -- A round with exactly one match is the final -- once it's decided
  -- (completed or a bye), there's nothing left to advance to.
  if v_match_count = 1 and v_incomplete_count = 0 then
    update public.tournaments set status = 'completed'
    where id = v_tournament_id and status <> 'completed';
  end if;
end;
$$;

revoke execute on function public.maybe_complete_tournament(uuid) from public;

-- =========================================================================
-- report_match_result / confirm_match_result / admin_set_match_result:
-- add the golf score, and complete the tournament when its final match lands
-- =========================================================================

drop function public.report_match_result(uuid, uuid);

create function public.report_match_result(
  p_match_id uuid,
  p_winner_id uuid,
  p_score_type text,
  p_match_play_holes_up int default null,
  p_match_play_holes_remaining int default null,
  p_player1_score_to_par int default null,
  p_player2_score_to_par int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_match_participant(p_match_id) then
    raise exception 'not a participant in this match';
  end if;
  if p_winner_id not in (
    select player1_id from public.matches where id = p_match_id
    union select player2_id from public.matches where id = p_match_id
  ) then
    raise exception 'winner must be one of the two players';
  end if;
  if p_score_type not in ('match_play', 'stroke_play') then
    raise exception 'score_type must be match_play or stroke_play';
  end if;
  if p_score_type = 'match_play' and (p_match_play_holes_up is null or p_match_play_holes_remaining is null) then
    raise exception 'match play requires holes up and holes remaining';
  end if;
  if p_score_type = 'stroke_play' and (p_player1_score_to_par is null or p_player2_score_to_par is null) then
    raise exception 'stroke play requires both players'' scores';
  end if;

  update public.matches
  set reported_winner_id = p_winner_id,
      reported_by = auth.uid(),
      status = 'awaiting_confirmation',
      score_type = p_score_type,
      match_play_holes_up = case when p_score_type = 'match_play' then p_match_play_holes_up end,
      match_play_holes_remaining = case when p_score_type = 'match_play' then p_match_play_holes_remaining end,
      player1_score_to_par = case when p_score_type = 'stroke_play' then p_player1_score_to_par end,
      player2_score_to_par = case when p_score_type = 'stroke_play' then p_player2_score_to_par end
  where id = p_match_id;
end;
$$;

grant execute on function public.report_match_result(uuid, uuid, text, int, int, int, int) to authenticated;

create or replace function public.confirm_match_result(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reported_winner uuid;
  v_reported_by uuid;
begin
  if not public.is_match_participant(p_match_id) then
    raise exception 'not a participant in this match';
  end if;

  select reported_winner_id, reported_by into v_reported_winner, v_reported_by
    from public.matches where id = p_match_id;

  if v_reported_winner is null then
    raise exception 'no result has been reported for this match';
  end if;
  if v_reported_by = auth.uid() then
    raise exception 'the reporting player cannot self-confirm';
  end if;

  update public.matches set winner_id = v_reported_winner, status = 'completed'
  where id = p_match_id;

  perform public.maybe_complete_tournament(p_match_id);
end;
$$;

create or replace function public.admin_set_match_result(p_match_id uuid, p_winner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.current_is_admin() then
    raise exception 'admin only';
  end if;
  if public.match_club_id(p_match_id) <> public.current_club_id() then
    raise exception 'match not in your club';
  end if;

  update public.matches
  set winner_id = p_winner_id, reported_winner_id = p_winner_id, reported_by = auth.uid(), status = 'completed'
  where id = p_match_id;

  perform public.maybe_complete_tournament(p_match_id);
end;
$$;
