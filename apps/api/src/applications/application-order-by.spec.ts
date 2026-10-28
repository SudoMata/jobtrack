import { buildApplicationOrderBy } from './application-order-by';

describe('buildApplicationOrderBy', () => {
  it('sorts the newest application first, with stable tie-breakers', () => {
    expect(buildApplicationOrderBy('appliedAt_desc')).toEqual([
      { appliedAt: 'desc' },
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('sorts the oldest application first, with tie-breakers in the same direction', () => {
    expect(buildApplicationOrderBy('appliedAt_asc')).toEqual([
      { appliedAt: 'asc' },
      { createdAt: 'asc' },
      { id: 'asc' },
    ]);
  });
});
