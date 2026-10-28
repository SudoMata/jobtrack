import type { Prisma } from '../generated/prisma/client';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';

/**
 * Builds the `where` of the application list.
 * The owner is always part of it. The filters are combined with AND; the search looks in the
 * company name OR in the position (TECHNICAL_SPEC.md, section 20).
 */
export function buildApplicationWhere(
  userId: string,
  query: ListApplicationsQueryDto,
): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput = { userId };

  if (query.status) {
    where.status = query.status;
  }
  if (query.contractType) {
    where.contractType = query.contractType;
  }
  if (query.workMode) {
    where.workMode = query.workMode;
  }
  if (query.priority) {
    where.priority = query.priority;
  }
  if (query.location) {
    where.location = { contains: query.location, mode: 'insensitive' };
  }
  if (query.search) {
    where.OR = [
      { position: { contains: query.search, mode: 'insensitive' } },
      { company: { name: { contains: query.search, mode: 'insensitive' } } },
    ];
  }

  return where;
}
