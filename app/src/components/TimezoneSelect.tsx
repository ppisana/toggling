import { listTimezones } from '../lib/timezones'

const ZONES = listTimezones()

export function TimezoneSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (tz: string) => void
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-emerald-700/60 bg-emerald-950/70 px-3 py-2 text-sm text-amber-50 focus:border-amber-400 focus:outline-none"
    >
      {ZONES.map((tz) => (
        <option key={tz} value={tz} className="bg-emerald-950 text-amber-50">
          {tz.replace(/_/g, ' ')}
        </option>
      ))}
    </select>
  )
}
