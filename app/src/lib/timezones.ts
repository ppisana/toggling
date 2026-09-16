// A curated list covering the timezones a globally-scattered golf club is
// likely to need, grouped roughly by region. Falls back to the full IANA
// list when the runtime supports Intl.supportedValuesOf.
const CURATED = [
  'Pacific/Auckland',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Brisbane',
  'Australia/Perth',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/Moscow',
  'Europe/Istanbul',
  'Europe/Athens',
  'Europe/Paris',
  'Europe/Madrid',
  'Europe/London',
  'Atlantic/Azores',
  'America/Sao_Paulo',
  'America/Buenos_Aires',
  'America/Santiago',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Pacific/Honolulu',
]

export function listTimezones(): string[] {
  try {
    if (typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone')
    }
  } catch {
    // fall through to curated list
  }
  return CURATED
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
