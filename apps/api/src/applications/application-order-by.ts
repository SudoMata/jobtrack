import type { Prisma } from '../generated/prisma/client';
import { ApplicationSort } from './application-sort';

/**
 * Builds the `orderBy` of the application list from one of the two allowed sort values.
 * The creation date and then the id break ties in the same direction, so that two
 * applications of the same day keep their place from one page to the next.
 */
export function buildApplicationOrderBy(
  sort: ApplicationSort,
): Prisma.ApplicationOrderByWithRelationInput[] {
  const direction = sort === 'appliedAt_asc' ? 'asc' : 'desc';

  return [{ appliedAt: direction }, { createdAt: direction }, { id: direction }];
}
