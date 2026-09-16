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
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
    >
      {ZONES.map((tz) => (
        <option key={tz} value={tz}>
          {tz.replace(/_/g, ' ')}
        </option>
      ))}
    </select>
  )
}
