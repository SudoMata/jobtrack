/**
 * The identity extracted from a verified access token.
 * It contains only what the application needs; role and account status are never
 * read from the token, they come from the database (TECHNICAL_SPEC.md, section 4.2).
 */
export interface AuthenticatedIdentity {
  /** Supabase Auth user id. It is also the primary key of the application user. */
  id: string;

  /** Verified email address, normalized to lowercase. */
  email: string;
}
