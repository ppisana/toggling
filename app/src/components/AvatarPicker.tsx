import { AVATAR_OPTIONS } from '../lib/avatars'

export function AvatarPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (avatar: string) => void
}) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {AVATAR_OPTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onChange(emoji)}
          className={`flex h-10 w-10 items-center justify-center rounded-lg border text-xl transition ${
            value === emoji
              ? 'border-amber-400 bg-amber-400/10 ring-2 ring-amber-400'
              : 'border-emerald-700/60 bg-emerald-950/40 hover:border-amber-400/50'
          }`}
          aria-label={`Pick avatar ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
