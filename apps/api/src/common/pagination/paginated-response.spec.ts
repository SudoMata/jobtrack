import { buildPaginated } from './paginated-response';

describe('buildPaginated', () => {
  it('builds the standard response', () => {
    expect(buildPaginated(['a', 'b'], 42, 1, 20)).toEqual({
      data: ['a', 'b'],
      meta: { page: 1, limit: 20, total: 42, totalPages: 3 },
    });
  });

  it('rounds the number of pages up', () => {
    expect(buildPaginated([], 41, 1, 20).meta.totalPages).toBe(3);
    expect(buildPaginated([], 40, 1, 20).meta.totalPages).toBe(2);
  });

  it('reports no page at all for an empty result', () => {
    expect(buildPaginated([], 0, 1, 20).meta).toEqual({
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it('keeps the requested page number when it is beyond the last page', () => {
    expect(buildPaginated([], 42, 9, 20)).toEqual({
      data: [],
      meta: { page: 9, limit: 20, total: 42, totalPages: 3 },
    });
  });
});
