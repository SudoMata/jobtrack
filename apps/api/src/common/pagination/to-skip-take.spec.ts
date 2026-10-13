import { toSkipTake } from './to-skip-take';

describe('toSkipTake', () => {
  it('skips nothing on the first page', () => {
    expect(toSkipTake({ page: 1, limit: 20 })).toEqual({ skip: 0, take: 20 });
  });

  it('skips the previous pages', () => {
    expect(toSkipTake({ page: 3, limit: 20 })).toEqual({ skip: 40, take: 20 });
  });
});
