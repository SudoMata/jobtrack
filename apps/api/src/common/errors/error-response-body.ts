/**
 * The only shape an error response can have (TECHNICAL_SPEC.md, section 27).
 */
export interface ErrorResponseBody {
  statusCode: number;
  message: string;

  /** Field errors of a validation failure, keyed by field path. */
  errors?: Record<string, string[]>;

  /** Stable machine-readable identifier, for errors the client must tell apart. */
  code?: string;
}
