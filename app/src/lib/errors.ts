/** Supabase/PostgREST errors are plain objects, not `Error` instances, so
 * `err instanceof Error` misses them. Pull `.message` off anything shaped
 * like an error before falling back to a generic string. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message
  }
  return fallback
}
