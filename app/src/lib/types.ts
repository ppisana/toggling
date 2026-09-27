export type MatchStatus = 'pending' | 'scheduled' | 'awaiting_confirmation' | 'completed' | 'bye'
export type TournamentStatus = 'draft' | 'active' | 'completed'
export type ProposalStatus = 'pending' | 'accepted' | 'declined' | 'cancelled'
export type ScoreType = 'match_play' | 'stroke_play'

export interface Club {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export interface Profile {
  id: string
  club_id: string
  nickname: string
  avatar_url: string | null
  timezone: string
  is_admin: boolean
  created_at: string
}

export interface Tournament {
  id: string
  club_id: string
  name: string
  status: TournamentStatus
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export interface Match {
  id: string
  tournament_id: string
  round: number
  slot_in_round: number
  player1_id: string | null
  player2_id: string | null
  winner_id: string | null
  reported_winner_id: string | null
  reported_by: string | null
  status: MatchStatus
  scheduled_at: string | null
  created_at: string
  completed_at: string | null
  score_type: ScoreType | null
  match_play_holes_up: number | null
  match_play_holes_remaining: number | null
  player1_score_to_par: number | null
  player2_score_to_par: number | null
}

export interface MatchProposal {
  id: string
  match_id: string
  proposed_by: string
  proposed_at: string
  status: ProposalStatus
  created_at: string
}

export interface MatchMessage {
  id: string
  match_id: string
  sender_id: string
  body: string
  created_at: string
}
