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
              ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500'
              : 'border-slate-300 hover:border-emerald-400 dark:border-slate-700'
          }`}
          aria-label={`Elegir avatar ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
