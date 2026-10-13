/**
 * Converts page and limit into the `skip` and `take` arguments of a Prisma query.
 * Page 1 skips nothing; a page beyond the last one simply returns no rows.
 */
export function toSkipTake(pagination: { page: number; limit: number }): {
  skip: number;
  take: number;
} {
  return {
    skip: (pagination.page - 1) * pagination.limit,
    take: pagination.limit,
  };
}
