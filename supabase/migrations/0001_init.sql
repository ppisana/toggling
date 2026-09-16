-- Knockout Golf Scheduler
-- Anonymous, timezone-aware bracket scheduling for a Country Club's WGT knockout tournaments.

create extension if not exists pgcrypto;

-- =========================================================================
-- TABLES
-- =========================================================================

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 32),
  avatar_url text,
  timezone text not null default 'UTC',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  unique (club_id, nickname)
);

create index profiles_club_id_idx on public.profiles (club_id);

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index tournaments_club_id_idx on public.tournaments (club_id);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round int not null check (round >= 1),
  slot_in_round int not null check (slot_in_round >= 0),
  player1_id uuid references public.profiles(id) on delete set null,
  player2_id uuid references public.profiles(id) on delete set null,
  winner_id uuid references public.profiles(id) on delete set null,
  reported_winner_id uuid references public.profiles(id) on delete set null,
  reported_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'scheduled', 'awaiting_confirmation', 'completed', 'bye')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tournament_id, round, slot_in_round)
);

create index matches_tournament_id_idx on public.matches (tournament_id);
create index matches_players_idx on public.matches (player1_id, player2_id);

create table public.match_proposals (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id) on delete cascade,
  proposed_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now()
);

create index match_proposals_match_id_idx on public.match_proposals (match_id);

create table public.match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index match_messages_match_id_idx on public.match_messages (match_id, created_at);

-- =========================================================================
-- HELPER FUNCTIONS (security definer, used by RLS policies to avoid recursion)
-- =========================================================================

create function public.current_club_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select club_id from public.profiles where id = auth.uid();
$$;

create function public.current_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create function public.is_match_participant(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches
    where id = p_match_id
      and (player1_id = auth.uid() or player2_id = auth.uid())
  );
$$;

create function public.match_club_id(p_match_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.club_id
  from public.matches m
  join public.tournaments t on t.id = m.tournament_id
  where m.id = p_match_id;
$$;

-- =========================================================================
-- ROW LEVEL SECURITY
-- =========================================================================

alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.matches enable row level security;
alter table public.match_proposals enable row level security;
alter table public.match_messages enable row level security;

-- clubs: members can read their own club. All writes go through RPCs.
create policy clubs_select_own on public.clubs
  for select using (id = public.current_club_id());

-- profiles: club-mates can see each other; users manage only their own row.
create policy profiles_select_clubmates on public.profiles
  for select using (club_id = public.current_club_id());

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Prevent players from granting themselves admin or switching clubs via a raw update.
create function public.enforce_profile_immutable_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.club_id := old.club_id;
  new.is_admin := old.is_admin;
  return new;
end;
$$;

create trigger profiles_lock_privileges
  before update on public.profiles
  for each row execute function public.enforce_profile_immutable_fields();

-- tournaments: club members read; only admins create/update via RPCs (no direct DML grants below).
create policy tournaments_select_club on public.tournaments
  for select using (club_id = public.current_club_id());

-- matches: club members can read; all writes happen through security-definer RPCs.
create policy matches_select_club on public.matches
  for select using (
    exists (
      select 1 from public.tournaments t
      where t.id = matches.tournament_id and t.club_id = public.current_club_id()
    )
  );

-- match_proposals: participants + admin can read; writes go through RPCs.
create policy match_proposals_select on public.match_proposals
  for select using (
    public.is_match_participant(match_id) or public.current_is_admin()
  );

-- match_messages: participants + admin can read and post directly (simple chat).
create policy match_messages_select on public.match_messages
  for select using (
    public.is_match_participant(match_id) or public.current_is_admin()
  );

create policy match_messages_insert on public.match_messages
  for insert with check (
    sender_id = auth.uid()
    and (public.is_match_participant(match_id) or public.current_is_admin())
  );

-- Note: no INSERT/UPDATE/DELETE policies exist for clubs, tournaments, matches,
-- or match_proposals -- every mutation on those tables happens inside the
-- SECURITY DEFINER functions below, which run with elevated privileges and
-- enforce their own authorization checks.

-- =========================================================================
-- INVITE CODE GENERATION
-- =========================================================================

create function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  code text;
  exists_already boolean;
begin
  loop
    code := '';
    for i in 1..7 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select exists(select 1 from public.clubs where invite_code = code) into exists_already;
    exit when not exists_already;
  end loop;
  return code;
end;
$$;

-- =========================================================================
-- RPCS: club lifecycle
-- =========================================================================

create function public.create_club(p_name text, p_nickname text, p_avatar_url text, p_timezone text)
returns table (club_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'you already belong to a club';
  end if;

  v_code := public.generate_invite_code();

  insert into public.clubs (name, invite_code) values (p_name, v_code)
  returning id into v_club_id;

  insert into public.profiles (id, club_id, nickname, avatar_url, timezone, is_admin)
  values (auth.uid(), v_club_id, p_nickname, p_avatar_url, coalesce(p_timezone, 'UTC'), true);

  return query select v_club_id, v_code;
end;
$$;

create function public.join_club(p_code text, p_nickname text, p_avatar_url text, p_timezone text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'you already belong to a club';
  end if;

  select id into v_club_id from public.clubs where invite_code = upper(p_code);
  if v_club_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into public.profiles (id, club_id, nickname, avatar_url, timezone, is_admin)
  values (auth.uid(), v_club_id, p_nickname, p_avatar_url, coalesce(p_timezone, 'UTC'), false);

  return v_club_id;
exception
  when unique_violation then
    raise exception 'that nickname is already taken in this club';
end;
$$;

create function public.regenerate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
  v_code text;
begin
  if not public.current_is_admin() then
    raise exception 'admin only';
  end if;
  v_club_id := public.current_club_id();
  v_code := public.generate_invite_code();
  update public.clubs set invite_code = v_code where id = v_club_id;
  return v_code;
end;
$$;

-- =========================================================================
-- RPCS: tournament + bracket lifecycle
-- =========================================================================

create function public.create_tournament(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.current_is_admin() then
    raise exception 'admin only';
  end if;
  insert into public.tournaments (club_id, name, created_by)
  values (public.current_club_id(), p_name, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- Randomly seeds round 1 from the given player ids (must belong to the admin's club).
-- Odd player counts get one random bye that auto-advances.
create function public.generate_bracket(p_tournament_id uuid, p_player_ids uuid[])
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
      -- odd one out: automatic bye into round 1
      insert into public.matches (tournament_id, round, slot_in_round, player1_id, player2_id, winner_id, status)
      values (p_tournament_id, 1, slot, shuffled[i], null, shuffled[i], 'bye');
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

-- Builds the next round from the current round's winners once it is fully decided.
create function public.advance_round(p_tournament_id uuid)
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
    update public.tournaments set status = 'completed' where id = p_tournament_id;
    return;
  end if;

  i := 1;
  while i <= n loop
    if i = n then
      insert into public.matches (tournament_id, round, slot_in_round, player1_id, player2_id, winner_id, status)
      values (p_tournament_id, v_current_round + 1, slot, winners[i], null, winners[i], 'bye');
    else
      insert into public.matches (tournament_id, round, slot_in_round, player1_id, player2_id, status)
      values (p_tournament_id, v_current_round + 1, slot, winners[i], winners[i + 1], 'pending');
    end if;
    slot := slot + 1;
    i := i + 2;
  end loop;
end;
$$;

-- =========================================================================
-- RPCS: match scheduling
-- =========================================================================

create function public.propose_match_time(p_match_id uuid, p_proposed_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_match_participant(p_match_id) then
    raise exception 'not a participant in this match';
  end if;
  if p_proposed_at <= now() then
    raise exception 'proposed time must be in the future';
  end if;

  insert into public.match_proposals (match_id, proposed_by, proposed_at)
  values (p_match_id, auth.uid(), p_proposed_at)
  returning id into v_id;

  return v_id;
end;
$$;

create function public.respond_to_proposal(p_proposal_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_proposed_by uuid;
  v_proposed_at timestamptz;
begin
  select match_id, proposed_by, proposed_at
    into v_match_id, v_proposed_by, v_proposed_at
    from public.match_proposals
    where id = p_proposal_id and status = 'pending';

  if v_match_id is null then
    raise exception 'proposal not found or already resolved';
  end if;
  if not public.is_match_participant(v_match_id) then
    raise exception 'not a participant in this match';
  end if;
  if v_proposed_by = auth.uid() then
    raise exception 'you cannot respond to your own proposal';
  end if;

  if p_accept then
    update public.match_proposals set status = 'accepted' where id = p_proposal_id;
    update public.match_proposals set status = 'cancelled'
      where match_id = v_match_id and status = 'pending' and id <> p_proposal_id;
    update public.matches set scheduled_at = v_proposed_at, status = 'scheduled'
      where id = v_match_id;
  else
    update public.match_proposals set status = 'declined' where id = p_proposal_id;
  end if;
end;
$$;

-- =========================================================================
-- RPCS: match results
-- =========================================================================

create function public.report_match_result(p_match_id uuid, p_winner_id uuid)
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

  update public.matches
  set reported_winner_id = p_winner_id, reported_by = auth.uid(), status = 'awaiting_confirmation'
  where id = p_match_id;
end;
$$;

create function public.confirm_match_result(p_match_id uuid)
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
end;
$$;

create function public.admin_set_match_result(p_match_id uuid, p_winner_id uuid)
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
end;
$$;
