/**
 * Builds the base URL of Supabase Auth from the project URL.
 * It is used both as the token issuer and as the base of the JWKS address.
 */
export function getSupabaseAuthUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;
}
