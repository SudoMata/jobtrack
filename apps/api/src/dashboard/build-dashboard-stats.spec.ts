import { buildDashboardStats } from './build-dashboard-stats';

describe('buildDashboardStats', () => {
  it('answers zero everywhere when there is no application', () => {
    expect(buildDashboardStats([])).toEqual({
      total: 0,
      byStatus: { APPLIED: 0, SCREENING: 0, INTERVIEW: 0, OFFER: 0, REJECTED: 0 },
    });
  });

  it('counts the statuses that exist and keeps the others at zero', () => {
    const stats = buildDashboardStats([
      { status: 'APPLIED', count: 10 },
      { status: 'INTERVIEW', count: 6 },
    ]);

    expect(stats.byStatus).toEqual({
      APPLIED: 10,
      SCREENING: 0,
      INTERVIEW: 6,
      OFFER: 0,
      REJECTED: 0,
    });
  });

  it('computes the total as the sum of the statuses', () => {
    const stats = buildDashboardStats([
      { status: 'APPLIED', count: 10 },
      { status: 'SCREENING', count: 4 },
      { status: 'INTERVIEW', count: 6 },
      { status: 'OFFER', count: 2 },
      { status: 'REJECTED', count: 2 },
    ]);

    expect(stats.total).toBe(24);
  });
});
