import { DateTime } from 'luxon'

/** Format a UTC ISO timestamp in the viewer's own device timezone. */
export function formatLocal(isoUtc: string): string {
  return DateTime.fromISO(isoUtc, { zone: 'utc' })
    .toLocal()
    .toFormat("cccc d LLL, HH:mm '('ZZZZ')'")
}

/** Format a UTC ISO timestamp in a specific IANA timezone (e.g. a profile's). */
export function formatInZone(isoUtc: string, zone: string): string {
  return DateTime.fromISO(isoUtc, { zone: 'utc' })
    .setZone(zone)
    .toFormat("cccc d LLL, HH:mm '('ZZZZ')'")
}

/** Convert a <input type="datetime-local"> value (interpreted in the browser's
 * own timezone) into a UTC ISO string suitable for storing in Postgres. */
export function localInputToUtcIso(localValue: string): string {
  return DateTime.fromISO(localValue).toUTC().toISO() as string
}

/** Minimum value for a datetime-local input: a few minutes from now. */
export function minDateTimeLocal(): string {
  return DateTime.local().plus({ minutes: 5 }).toFormat("yyyy-LL-dd'T'HH:mm")
}
