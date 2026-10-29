import type { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

const USER_ID = '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60';

describe('DashboardService', () => {
  const groupBy = jest.fn();
  const service = new DashboardService({ application: { groupBy } } as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('counts the applications of the user by status with a single grouped query', async () => {
    groupBy.mockResolvedValue([
      { status: 'APPLIED', _count: { _all: 2 } },
      { status: 'OFFER', _count: { _all: 1 } },
    ]);

    await expect(service.getStats(USER_ID)).resolves.toEqual({
      total: 3,
      byStatus: { APPLIED: 2, SCREENING: 0, INTERVIEW: 0, OFFER: 1, REJECTED: 0 },
    });

    expect(groupBy).toHaveBeenCalledTimes(1);
    expect(groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { userId: USER_ID },
      _count: { _all: true },
    });
  });

  it('answers zeros when the user has no application', async () => {
    groupBy.mockResolvedValue([]);

    await expect(service.getStats(USER_ID)).resolves.toMatchObject({ total: 0 });
  });
});
