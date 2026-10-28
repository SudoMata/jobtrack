import { randomUUID } from 'node:crypto';
import { Prisma } from '../../src/generated/prisma/client';
import type {
  Application,
  ApplicationStatusHistory,
  Company,
  User,
} from '../../src/generated/prisma/client';
import {
  AccountStatus,
  ApplicationSource,
  ApplicationStatus,
  ContractType,
  Priority,
  Role,
  WorkMode,
} from '../../src/generated/prisma/enums';

interface TextFilter {
  contains: string;
}

interface CompanyWhere {
  id?: string;
  userId?: string;
  name?: TextFilter;
}

interface CompanyFields {
  name?: string;
  website?: string | null;
  location?: string | null;
}

interface ApplicationWhere {
  id?: string;
  userId?: string;
  status?: ApplicationStatus;
  contractType?: ContractType;
  workMode?: WorkMode;
  priority?: Priority;
  location?: TextFilter;
  companyId?: string;
  OR?: { position?: TextFilter; company?: { name: TextFilter } }[];
}

interface ApplicationCreateData {
  userId: string;
  companyId: string;
  position: string;
  contractType: ContractType;
  location?: string | null;
  workMode?: WorkMode | null;
  jobUrl?: string | null;
  appliedAt: Date;
  status: ApplicationStatus;
  salaryAmount?: string | null;
  salaryCurrency?: string | null;
  notes?: string | null;
  source: ApplicationSource;
  priority?: Priority;
  nextFollowUpAt?: Date | null;
  statusHistory: {
    create: {
      fromStatus: ApplicationStatus | null;
      toStatus: ApplicationStatus;
      changedByUserId: string;
    };
  };
}

interface Projection {
  include?: { company?: unknown };
  select?: Record<string, boolean>;
}

const SUPPORTED_APPLICATION_FILTERS = new Set([
  'id',
  'userId',
  'companyId',
  'status',
  'contractType',
  'workMode',
  'priority',
  'location',
  'OR',
]);

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Simulated database error', {
    code,
    clientVersion: 'test',
  });
}

/** Runs work as a promise, so that a thrown error becomes a rejection like in Prisma. */
function attempt<T>(work: () => T): Promise<T> {
  return Promise.resolve().then(work);
}

function toDecimal(value: string | null | undefined): Prisma.Decimal | null {
  return value === null || value === undefined ? null : new Prisma.Decimal(value);
}

function containsText(text: string | null | undefined, needle: string): boolean {
  return text !== null && text !== undefined && text.toLowerCase().includes(needle.toLowerCase());
}

/**
 * An in-memory stand-in for PrismaService, for end-to-end tests.
 *
 * It honors the filters it receives, and it fails loudly on a filter it does not know,
 * so a service that forgets to filter by owner makes the isolation tests fail. It also
 * reproduces the rules of the database: one company name per user ignoring case, the
 * composite foreign key between an application and its owner's company, companies that
 * are still in use, the cascade from an application to its history, and the rollback of
 * a transaction that fails.
 */
export function createFakePrisma() {
  const users = new Map<string, User>();
  const companies = new Map<string, Company>();
  let applications = new Map<string, Application>();
  let histories: ApplicationStatusHistory[] = [];

  /** Ids of companies that must be considered in use even without an application. */
  const companiesInUse = new Set<string>();
  let failNextHistory = false;

  // ---------------------------------------------------------------- companies

  const matchesCompany = (company: Company, where: CompanyWhere): boolean => {
    if (where.id !== undefined && company.id !== where.id) {
      return false;
    }
    if (where.userId !== undefined && company.userId !== where.userId) {
      return false;
    }
    if (where.name && !containsText(company.name, where.name.contains)) {
      return false;
    }
    return true;
  };

  const selectCompanies = (where: CompanyWhere): Company[] =>
    [...companies.values()].filter((company) => matchesCompany(company, where));

  const nameTaken = (userId: string, name: string, exceptId?: string): boolean =>
    [...companies.values()].some(
      (company) =>
        company.userId === userId &&
        company.id !== exceptId &&
        company.name.toLowerCase() === name.toLowerCase(),
    );

  const findOwnedCompany = (where: { id: string; userId: string }): Company => {
    const [company] = selectCompanies(where);
    if (!company) {
      throw prismaError('P2025');
    }
    return company;
  };

  const company = {
    create: ({ data }: { data: CompanyFields & { userId: string; name: string } }) =>
      attempt(() => {
        if (nameTaken(data.userId, data.name)) {
          throw prismaError('P2002');
        }
        const now = new Date();
        const created: Company = {
          id: randomUUID(),
          userId: data.userId,
          name: data.name,
          website: data.website ?? null,
          location: data.location ?? null,
          createdAt: now,
          updatedAt: now,
        };
        companies.set(created.id, created);
        return created;
      }),

    findMany: ({ where, skip = 0, take }: { where: CompanyWhere; skip?: number; take: number }) =>
      attempt(() =>
        selectCompanies(where)
          .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
          .slice(skip, skip + take),
      ),

    count: ({ where }: { where: CompanyWhere }) => attempt(() => selectCompanies(where).length),

    findFirstOrThrow: ({ where }: { where: { id: string; userId: string } }) =>
      attempt(() => findOwnedCompany(where)),

    update: ({ where, data }: { where: { id: string; userId: string }; data: CompanyFields }) =>
      attempt(() => {
        const existing = findOwnedCompany(where);
        if (data.name !== undefined && nameTaken(existing.userId, data.name, existing.id)) {
          throw prismaError('P2002');
        }
        const updated: Company = {
          ...existing,
          ...(data.name !== undefined && { name: data.name }),
          ...(data.website !== undefined && { website: data.website }),
          ...(data.location !== undefined && { location: data.location }),
          updatedAt: new Date(),
        };
        companies.set(updated.id, updated);
        return updated;
      }),

    delete: ({ where }: { where: { id: string; userId: string } }) =>
      attempt(() => {
        const existing = findOwnedCompany(where);
        const usedByAnApplication = [...applications.values()].some(
          (application) => application.companyId === existing.id,
        );
        if (companiesInUse.has(existing.id) || usedByAnApplication) {
          throw prismaError('P2003');
        }
        companies.delete(existing.id);
        return existing;
      }),
  };

  // ------------------------------------------------------------- applications

  const matchesApplication = (application: Application, where: ApplicationWhere): boolean => {
    for (const key of Object.keys(where)) {
      if (!SUPPORTED_APPLICATION_FILTERS.has(key)) {
        throw new Error(`The fake database does not support the filter "${key}"`);
      }
    }

    const exactFilters = [
      'id',
      'userId',
      'companyId',
      'status',
      'contractType',
      'workMode',
      'priority',
    ] as const;
    for (const key of exactFilters) {
      if (where[key] !== undefined && application[key] !== where[key]) {
        return false;
      }
    }
    if (where.location && !containsText(application.location, where.location.contains)) {
      return false;
    }
    if (where.OR) {
      const found = where.OR.some(
        (condition) =>
          (condition.position && containsText(application.position, condition.position.contains)) ||
          (condition.company &&
            containsText(
              companies.get(application.companyId)?.name,
              condition.company.name.contains,
            )),
      );
      if (!found) {
        return false;
      }
    }
    return true;
  };

  const selectApplications = (where: ApplicationWhere): Application[] =>
    [...applications.values()].filter((application) => matchesApplication(application, where));

  const findOwnedApplication = (where: { id: string; userId: string }): Application => {
    const [application] = selectApplications(where);
    if (!application) {
      throw prismaError('P2025');
    }
    return application;
  };

  /** The composite foreign key: the company must exist and belong to the application's owner. */
  const assertCompanyOfOwner = (companyId: string, userId: string): void => {
    const target = companies.get(companyId);
    if (!target || target.userId !== userId) {
      throw prismaError('P2003');
    }
  };

  const project = (application: Application, projection: Projection = {}): unknown => {
    if (projection.select) {
      return Object.fromEntries(
        Object.entries(projection.select)
          .filter(([, selected]) => selected)
          .map(([key]) => [key, application[key as keyof Application]]),
      );
    }
    if (projection.include?.company) {
      const owner = companies.get(application.companyId);
      return { ...application, company: owner ? { id: owner.id, name: owner.name } : null };
    }
    return application;
  };

  const application = {
    create: ({ data, include }: { data: ApplicationCreateData; include?: Projection['include'] }) =>
      attempt(() => {
        assertCompanyOfOwner(data.companyId, data.userId);
        const now = new Date();
        const created: Application = {
          id: randomUUID(),
          userId: data.userId,
          companyId: data.companyId,
          position: data.position,
          contractType: data.contractType,
          location: data.location ?? null,
          workMode: data.workMode ?? null,
          jobUrl: data.jobUrl ?? null,
          appliedAt: data.appliedAt,
          status: data.status,
          salaryAmount: toDecimal(data.salaryAmount),
          salaryCurrency: data.salaryCurrency ?? null,
          notes: data.notes ?? null,
          source: data.source,
          priority: data.priority ?? Priority.NORMAL,
          nextFollowUpAt: data.nextFollowUpAt ?? null,
          createdAt: now,
          updatedAt: now,
        };
        // The application and its first history line are written together.
        applications.set(created.id, created);
        histories.push({
          id: randomUUID(),
          applicationId: created.id,
          ...data.statusHistory.create,
          changedAt: now,
        });
        return project(created, { include });
      }),

    findMany: ({
      where,
      orderBy,
      include,
      skip = 0,
      take,
    }: {
      where: ApplicationWhere;
      orderBy: { appliedAt?: 'asc' | 'desc' }[];
      include?: Projection['include'];
      skip?: number;
      take: number;
    }) =>
      attempt(() => {
        const direction = orderBy[0]?.appliedAt === 'asc' ? 1 : -1;
        return selectApplications(where)
          .sort(
            (a, b) =>
              direction *
              (a.appliedAt.getTime() - b.appliedAt.getTime() ||
                a.createdAt.getTime() - b.createdAt.getTime() ||
                a.id.localeCompare(b.id)),
          )
          .slice(skip, skip + take)
          .map((row) => project(row, { include }));
      }),

    count: ({ where }: { where: ApplicationWhere }) =>
      attempt(() => selectApplications(where).length),

    findFirstOrThrow: ({
      where,
      include,
      select,
    }: { where: { id: string; userId: string } } & Projection) =>
      attempt(() => project(findOwnedApplication(where), { include, select })),

    update: ({
      where,
      data,
      include,
    }: {
      where: { id: string; userId: string };
      data: Record<string, unknown>;
      include?: Projection['include'];
    }) =>
      attempt(() => {
        const existing = findOwnedApplication(where);
        if (typeof data.companyId === 'string') {
          assertCompanyOfOwner(data.companyId, existing.userId);
        }
        const updated: Record<string, unknown> = { ...existing, updatedAt: new Date() };
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) {
            updated[key] = key === 'salaryAmount' ? toDecimal(value as string | null) : value;
          }
        }
        applications.set(existing.id, updated as unknown as Application);
        return project(updated as unknown as Application, { include });
      }),

    updateMany: ({
      where,
      data,
    }: {
      where: { id: string; userId: string; status: ApplicationStatus };
      data: { status: ApplicationStatus };
    }) =>
      attempt(() => {
        const matching = selectApplications(where);
        for (const row of matching) {
          applications.set(row.id, { ...row, ...data, updatedAt: new Date() });
        }
        return { count: matching.length };
      }),

    delete: ({ where }: { where: { id: string; userId: string } }) =>
      attempt(() => {
        const existing = findOwnedApplication(where);
        applications.delete(existing.id);
        // The status history is deleted with the application (cascade).
        histories = histories.filter((line) => line.applicationId !== existing.id);
        return existing;
      }),
  };

  const applicationStatusHistory = {
    create: ({ data }: { data: Omit<ApplicationStatusHistory, 'id' | 'changedAt'> }) =>
      attempt(() => {
        if (failNextHistory) {
          failNextHistory = false;
          throw new Error('Simulated failure while writing the status history');
        }
        const line: ApplicationStatusHistory = { id: randomUUID(), ...data, changedAt: new Date() };
        histories.push(line);
        return line;
      }),
  };

  // -------------------------------------------------------------------- users

  const user = {
    findUnique: ({ where }: { where: { id: string } }) =>
      attempt(() => users.get(where.id) ?? null),

    create: ({ data }: { data: { id: string; email: string } }) =>
      attempt(() => {
        const now = new Date();
        const created: User = {
          ...data,
          role: Role.USER,
          accountStatus: AccountStatus.ACTIVE,
          displayName: null,
          createdAt: now,
          updatedAt: now,
        };
        users.set(created.id, created);
        return created;
      }),
  };

  // ------------------------------------------------------------- transactions

  /**
   * A list of queries runs as it is. A callback runs inside a transaction: if it fails,
   * everything it wrote is rolled back, like in the real database.
   */
  const $transaction = async (
    work: Promise<unknown>[] | ((client: unknown) => Promise<unknown>),
  ): Promise<unknown> => {
    if (Array.isArray(work)) {
      return Promise.all(work);
    }

    const savedApplications = new Map(applications);
    const savedHistories = [...histories];
    try {
      return await work({ application, applicationStatusHistory });
    } catch (error) {
      applications = savedApplications;
      histories = savedHistories;
      throw error;
    }
  };

  return {
    client: { user, company, application, applicationStatusHistory, $transaction },
    companiesInUse,

    /** The status history lines of an application, oldest first. */
    historyOf: (applicationId: string) =>
      histories
        .filter((line) => line.applicationId === applicationId)
        .map(({ fromStatus, toStatus, changedByUserId }) => ({
          fromStatus,
          toStatus,
          changedByUserId,
        })),

    /** Makes the next write of a status history line fail. */
    failNextHistoryWrite: (): void => {
      failNextHistory = true;
    },

    reset(): void {
      users.clear();
      companies.clear();
      applications = new Map();
      histories = [];
      companiesInUse.clear();
      failNextHistory = false;
    },
  };
}
