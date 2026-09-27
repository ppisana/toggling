-- Track when a tournament/match actually finished so the dashboard can show
-- "not completed, plus anything completed recently" instead of everything
-- ever played piling up forever.

alter table public.tournaments add column completed_at timestamptz;
alter table public.matches add column completed_at timestamptz;

-- Backfill: these already-completed rows predate the column, so give them a
-- timestamp instead of having them vanish immediately once the frontend
-- starts filtering on completed_at.
update public.tournaments set completed_at = now() where status = 'completed' and completed_at is null;
update public.matches set completed_at = now() where status in ('completed', 'bye') and completed_at is null;

create or replace function public.maybe_complete_tournament(p_match_id uuid)
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

  if v_match_count = 1 and v_incomplete_count = 0 then
    update public.tournaments set status = 'completed', completed_at = now()
    where id = v_tournament_id and status <> 'completed';
  end if;
end;
$$;

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

  update public.matches set winner_id = v_reported_winner, status = 'completed', completed_at = now()
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
  set winner_id = p_winner_id, reported_winner_id = p_winner_id, reported_by = auth.uid(),
      status = 'completed', completed_at = now()
  where id = p_match_id;

  perform public.maybe_complete_tournament(p_match_id);
end;
$$;

create or replace function public.generate_bracket(p_tournament_id uuid, p_player_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  shuffled uuid[];
  n int;
  i int;
  slot int := 0;
begin
  if not public.current_is_admin() then
    raise exception 'admin only';
  end if;
  v_club_id := public.current_club_id();

  if not exists (
    select 1 from public.tournaments
    where id = p_tournament_id and club_id = v_club_id and status = 'draft'
  ) then
    raise exception 'tournament not found or not in draft status';
  end if;

  if exists (
    select 1 from unnest(p_player_ids) pid
    left join public.profiles pr on pr.id = pid and pr.club_id = v_club_id
    where pr.id is null
  ) then
    raise exception 'all players must belong to your club';
  end if;

  select array_agg(pid order by random()) into shuffled from unnest(p_player_ids) pid;
  n := coalesce(array_length(shuffled, 1), 0);
  if n < 2 then
    raise exception 'need at least 2 players';
  end if;

  i := 1;
  while i <= n loop
    if i = n then
      insert into public.matches (tournament_id, round, slot_in_round, player1_id, player2_id, winner_id, status, completed_at)
      values (p_tournament_id, 1, slot, shuffled[i], null, shuffled[i], 'bye', now());
    else
      insert into public.matches (tournament_id, round, slot_in_round, player1_id, player2_id, status)
      values (p_tournament_id, 1, slot, shuffled[i], shuffled[i + 1], 'pending');
    end if;
    slot := slot + 1;
    i := i + 2;
  end loop;

  update public.tournaments set status = 'active' where id = p_tournament_id;
end;
$$;

create or replace function public.advance_round(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_current_round int;
  winners uuid[];
  n int;
  i int;
  slot int := 0;
begin
  if not public.current_is_admin() then
    raise exception 'admin only';
  end if;
  v_club_id := public.current_club_id();

  if not exists (select 1 from public.tournaments where id = p_tournament_id and club_id = v_club_id) then
    raise exception 'tournament not found';
  end if;

  select max(round) into v_current_round from public.matches where tournament_id = p_tournament_id;
  if v_current_round is null then
    raise exception 'no bracket generated yet';
  end if;

  if exists (
    select 1 from public.matches
    where tournament_id = p_tournament_id and round = v_current_round
      and status not in ('completed', 'bye')
  ) then
    raise exception 'current round is not finished yet';
  end if;

  select array_agg(winner_id order by slot_in_round)
    into winners
    from public.matches
    where tournament_id = p_tournament_id and round = v_current_round;

  n := coalesce(array_length(winners, 1), 0);

  if n <= 1 then
    update public.tournaments set status = 'completed', completed_at = now() where id = p_tournament_id;
    return;
  end if;

  i := 1;
  while i <= n loop
    if i = n then
      insert into public.matches (tournament_id, round, slot_in_round, player1_id, player2_id, winner_id, status, completed_at)
      values (p_tournament_id, v_current_round + 1, slot, winners[i], null, winners[i], 'bye', now());
    else
      insert into public.matches (tournament_id, round, slot_in_round, player1_id, player2_id, status)
      values (p_tournament_id, v_current_round + 1, slot, winners[i], winners[i + 1], 'pending');
    end if;
    slot := slot + 1;
    i := i + 2;
  end loop;
end;
$$;
