import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** Protects against absurd offsets: a page this high would overflow the database offset. */
export const MAX_PAGE = 1_000_000;

/**
 * Pagination parameters shared by every list endpoint (TECHNICAL_SPEC.md, section 25).
 * Invalid values are rejected with a 400, never silently corrected.
 */
export class PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number = DEFAULT_PAGE;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}
