import { buildAdminStats } from './build-admin-stats';

describe('buildAdminStats', () => {
  it('answers zero everywhere for an empty platform', () => {
    expect(
      buildAdminStats({
        period: '30d',
        usersByAccountStatus: [],
        newUsers: 0,
        applicationsByStatus: [],
        applicationsCreated: 0,
      }),
    ).toEqual({
      period: '30d',
      users: { total: 0, active: 0, suspended: 0, newUsers: 0 },
      applications: {
        total: 0,
        applicationsCreated: 0,
        byStatus: { APPLIED: 0, SCREENING: 0, INTERVIEW: 0, OFFER: 0, REJECTED: 0 },
      },
    });
  });

  it('counts the users by account status and the applications by status', () => {
    const stats = buildAdminStats({
      period: '7d',
      usersByAccountStatus: [
        { accountStatus: 'ACTIVE', count: 114 },
        { accountStatus: 'SUSPENDED', count: 6 },
      ],
      newUsers: 18,
      applicationsByStatus: [
        { status: 'APPLIED', count: 500 },
        { status: 'OFFER', count: 90 },
      ],
      applicationsCreated: 210,
    });

    expect(stats.period).toBe('7d');
    expect(stats.users).toEqual({ total: 120, active: 114, suspended: 6, newUsers: 18 });
    expect(stats.applications.total).toBe(590);
    expect(stats.applications.applicationsCreated).toBe(210);
    expect(stats.applications.byStatus).toMatchObject({ APPLIED: 500, OFFER: 90, REJECTED: 0 });
  });

  it('keeps an account status at zero when no user has it', () => {
    const stats = buildAdminStats({
      period: '30d',
      usersByAccountStatus: [{ accountStatus: 'ACTIVE', count: 3 }],
      newUsers: 1,
      applicationsByStatus: [],
      applicationsCreated: 0,
    });

    expect(stats.users).toMatchObject({ total: 3, active: 3, suspended: 0 });
  });
});
