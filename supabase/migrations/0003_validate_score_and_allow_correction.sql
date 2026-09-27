-- Server-side guard: in stroke play the declared winner must actually have
-- the better (lower) score -- the client already checks this, but the RPC
-- shouldn't trust it. report_match_result doubles as the "correct a wrong
-- report" action too (either participant can call it again while a match is
-- 'awaiting_confirmation', which simply replaces the pending report), so this
-- validation also protects that path.

create or replace function public.report_match_result(
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
declare
  v_player1_id uuid;
  v_player2_id uuid;
begin
  select player1_id, player2_id into v_player1_id, v_player2_id
    from public.matches where id = p_match_id;

  if not public.is_match_participant(p_match_id) then
    raise exception 'not a participant in this match';
  end if;
  if p_winner_id not in (v_player1_id, v_player2_id) then
    raise exception 'winner must be one of the two players';
  end if;
  if p_score_type not in ('match_play', 'stroke_play') then
    raise exception 'score_type must be match_play or stroke_play';
  end if;
  if p_score_type = 'match_play' and (p_match_play_holes_up is null or p_match_play_holes_remaining is null) then
    raise exception 'match play requires holes up and holes remaining';
  end if;
  if p_score_type = 'stroke_play' then
    if p_player1_score_to_par is null or p_player2_score_to_par is null then
      raise exception 'stroke play requires both players'' scores';
    end if;
    if p_player1_score_to_par = p_player2_score_to_par then
      raise exception 'scores are tied -- stroke play needs a lower score for the winner';
    end if;
    if (p_winner_id = v_player1_id and p_player1_score_to_par > p_player2_score_to_par)
      or (p_winner_id = v_player2_id and p_player2_score_to_par > p_player1_score_to_par) then
      raise exception 'the declared winner must have the lower score';
    end if;
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
