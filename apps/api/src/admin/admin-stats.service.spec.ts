import type { PrismaService } from '../prisma/prisma.service';
import { AdminStatsService } from './admin-stats.service';

describe('AdminStatsService', () => {
  const userGroupBy = jest.fn();
  const userCount = jest.fn();
  const applicationGroupBy = jest.fn();
  const applicationCount = jest.fn();
  const transaction = jest.fn();
  let service: AdminStatsService;

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation((queries: unknown[]) => Promise.all(queries));
    service = new AdminStatsService({
      user: { groupBy: userGroupBy, count: userCount },
      application: { groupBy: applicationGroupBy, count: applicationCount },
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  it('computes the platform statistics from counts, read in one transaction', async () => {
    userGroupBy.mockResolvedValue([
      { accountStatus: 'ACTIVE', _count: { _all: 9 } },
      { accountStatus: 'SUSPENDED', _count: { _all: 1 } },
    ]);
    userCount.mockResolvedValue(4);
    applicationGroupBy.mockResolvedValue([{ status: 'APPLIED', _count: { _all: 7 } }]);
    applicationCount.mockResolvedValue(5);

    const stats = await service.getStats('7d', new Date('2026-10-30T12:00:00.000Z'));

    expect(stats).toMatchObject({
      period: '7d',
      users: { total: 10, active: 9, suspended: 1, newUsers: 4 },
      applications: { total: 7, applicationsCreated: 5 },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('counts "new" users and applications from the start of the rolling window', async () => {
    userGroupBy.mockResolvedValue([]);
    userCount.mockResolvedValue(0);
    applicationGroupBy.mockResolvedValue([]);
    applicationCount.mockResolvedValue(0);

    await service.getStats('30d', new Date('2026-10-30T12:00:00.000Z'));

    const since = new Date('2026-09-30T12:00:00.000Z');
    expect(userCount).toHaveBeenCalledWith({ where: { createdAt: { gte: since } } });
    expect(applicationCount).toHaveBeenCalledWith({ where: { createdAt: { gte: since } } });
  });

  it('only counts: it never reads the content of an application', async () => {
    userGroupBy.mockResolvedValue([]);
    userCount.mockResolvedValue(0);
    applicationGroupBy.mockResolvedValue([]);
    applicationCount.mockResolvedValue(0);

    await service.getStats('30d');

    expect(applicationGroupBy).toHaveBeenCalledWith({
      by: ['status'],
      _count: { _all: true },
    });
    // The service has no other way to reach applications than these two counting queries.
    expect(Object.keys(applicationGroupBy.mock.calls[0][0] as object).sort()).toEqual([
      '_count',
      'by',
    ]);
  });
});
