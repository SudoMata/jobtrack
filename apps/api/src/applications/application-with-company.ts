import type { Prisma } from '../generated/prisma/client';

/** Every read and write of an application loads its company, reduced to what the API shows. */
export const WITH_COMPANY = {
  company: { select: { id: true, name: true } },
} satisfies Prisma.ApplicationInclude;

export type ApplicationWithCompany = Prisma.ApplicationGetPayload<{
  include: typeof WITH_COMPANY;
}>;
