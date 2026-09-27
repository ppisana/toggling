import type { Match } from './types'

/** "3 & 2" (won with holes still left) or "1 UP" (decided on the last hole). */
export function formatMatchPlayScore(holesUp: number, holesRemaining: number): string {
  return holesRemaining === 0 ? `${holesUp} UP` : `${holesUp} & ${holesRemaining}`
}

/** Strokes relative to par: -4, E (even), or +2. */
export function formatStrokeToPar(score: number): string {
  if (score === 0) return 'E'
  return score > 0 ? `+${score}` : `${score}`
}

/** One-line summary of a decided match's score, e.g. "3 & 2" or "-4 · -1". */
export function formatMatchScore(match: Match): string | null {
  if (match.score_type === 'match_play' && match.match_play_holes_up != null && match.match_play_holes_remaining != null) {
    return formatMatchPlayScore(match.match_play_holes_up, match.match_play_holes_remaining)
  }
  if (match.score_type === 'stroke_play' && match.player1_score_to_par != null && match.player2_score_to_par != null) {
    return `${formatStrokeToPar(match.player1_score_to_par)} · ${formatStrokeToPar(match.player2_score_to_par)}`
  }
  return null
}
