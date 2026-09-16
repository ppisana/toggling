// Emoji avatars keep profiles fully anonymous -- no uploaded photos that
// could leak identity metadata, no external image hosting to wire up.
export const AVATAR_OPTIONS = [
  '⛳', '🏌️', '🏌️‍♀️', '🏆', '🥇', '🐦', '🦅', '⛅',
  '🌴', '🐊', '🦩', '🐯', '🦁', '🐢', '🦈', '🐺',
  '🔥', '⚡', '❄️', '🌊', '🌵', '🍀', '🎯', '🎲',
]

export function randomAvatar(): string {
  return AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)]
}
