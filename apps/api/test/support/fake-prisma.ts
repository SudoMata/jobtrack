import { randomUUID } from 'node:crypto';
import { Prisma } from '../../src/generated/prisma/client';
import type { Company, User } from '../../src/generated/prisma/client';
import { AccountStatus, Role } from '../../src/generated/prisma/enums';

interface CompanyWhere {
  id?: string;
  userId?: string;
  name?: { contains: string };
}

interface CompanyFields {
  name?: string;
  website?: string | null;
  location?: string | null;
}

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Simulated database error', {
    code,
    clientVersion: 'test',
  });
}

/**
 * An in-memory stand-in for PrismaService, for end-to-end tests.
 * It honors the filters it receives (`id`, `userId`, `name`), so a service that forgets
 * to filter by owner makes the isolation tests fail. It also reproduces the database
 * rules: one company name per user ignoring case, and companies that are still in use.
 */
export function createFakePrisma() {
  const users = new Map<string, User>();
  const companies = new Map<string, Company>();

  /** Ids of companies that applications still use: deleting them is refused. */
  const companiesInUse = new Set<string>();

  const matches = (company: Company, where: CompanyWhere): boolean => {
    if (where.id !== undefined && company.id !== where.id) {
      return false;
    }
    if (where.userId !== undefined && company.userId !== where.userId) {
      return false;
    }
    if (where.name && !company.name.toLowerCase().includes(where.name.contains.toLowerCase())) {
      return false;
    }
    return true;
  };

  const select = (where: CompanyWhere): Company[] =>
    [...companies.values()].filter((company) => matches(company, where));

  const nameTaken = (userId: string, name: string, exceptId?: string): boolean =>
    [...companies.values()].some(
      (company) =>
        company.userId === userId &&
        company.id !== exceptId &&
        company.name.toLowerCase() === name.toLowerCase(),
    );

  const findOwned = (where: { id: string; userId: string }): Company => {
    const [company] = select(where);
    if (!company) {
      throw prismaError('P2025');
    }
    return company;
  };

  const client = {
    user: {
      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(users.get(where.id) ?? null),

      create: ({ data }: { data: { id: string; email: string } }) => {
        const now = new Date();
        const user: User = {
          ...data,
          role: Role.USER,
          accountStatus: AccountStatus.ACTIVE,
          displayName: null,
          createdAt: now,
          updatedAt: now,
        };
        users.set(user.id, user);
        return Promise.resolve(user);
      },
    },

    company: {
      create: ({ data }: { data: CompanyFields & { userId: string; name: string } }) => {
        if (nameTaken(data.userId, data.name)) {
          return Promise.reject(prismaError('P2002'));
        }
        const now = new Date();
        const company: Company = {
          id: randomUUID(),
          userId: data.userId,
          name: data.name,
          website: data.website ?? null,
          location: data.location ?? null,
          createdAt: now,
          updatedAt: now,
        };
        companies.set(company.id, company);
        return Promise.resolve(company);
      },

      findMany: ({ where, skip = 0, take }: { where: CompanyWhere; skip?: number; take: number }) =>
        Promise.resolve(
          select(where)
            .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
            .slice(skip, skip + take),
        ),

      count: ({ where }: { where: CompanyWhere }) => Promise.resolve(select(where).length),

      findFirstOrThrow: ({ where }: { where: { id: string; userId: string } }) => {
        try {
          return Promise.resolve(findOwned(where));
        } catch (error) {
          return Promise.reject(error);
        }
      },

      update: ({ where, data }: { where: { id: string; userId: string }; data: CompanyFields }) => {
        try {
          const company = findOwned(where);
          if (data.name !== undefined && nameTaken(company.userId, data.name, company.id)) {
            return Promise.reject(prismaError('P2002'));
          }
          const updated: Company = {
            ...company,
            ...(data.name !== undefined && { name: data.name }),
            ...(data.website !== undefined && { website: data.website }),
            ...(data.location !== undefined && { location: data.location }),
            updatedAt: new Date(),
          };
          companies.set(updated.id, updated);
          return Promise.resolve(updated);
        } catch (error) {
          return Promise.reject(error);
        }
      },

      delete: ({ where }: { where: { id: string; userId: string } }) => {
        try {
          const company = findOwned(where);
          if (companiesInUse.has(company.id)) {
            return Promise.reject(prismaError('P2003'));
          }
          companies.delete(company.id);
          return Promise.resolve(company);
        } catch (error) {
          return Promise.reject(error);
        }
      },
    },

    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  };

  return {
    client,
    companiesInUse,
    reset(): void {
      users.clear();
      companies.clear();
      companiesInUse.clear();
    },
  };
}
