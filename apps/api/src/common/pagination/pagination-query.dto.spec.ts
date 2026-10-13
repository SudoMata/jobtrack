import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../validation/create-validation-pipe';
import { PaginationQueryDto } from './pagination-query.dto';

describe('PaginationQueryDto', () => {
  const pipe = createValidationPipe();

  function parse(query: Record<string, string>): Promise<PaginationQueryDto> {
    return pipe.transform(query, {
      type: 'query',
      metatype: PaginationQueryDto,
    }) as Promise<PaginationQueryDto>;
  }

  it('applies the defaults when nothing is given', async () => {
    await expect(parse({})).resolves.toMatchObject({ page: 1, limit: 20 });
  });

  it('converts text values into numbers', async () => {
    await expect(parse({ page: '2', limit: '50' })).resolves.toMatchObject({ page: 2, limit: 50 });
  });

  it('accepts the maximum limit', async () => {
    await expect(parse({ limit: '100' })).resolves.toMatchObject({ limit: 100 });
  });

  it.each([
    ['page', '0'],
    ['page', '-1'],
    ['page', 'abc'],
    ['page', '1.5'],
    ['page', ''],
    ['page', '1000001'],
    ['limit', '0'],
    ['limit', '101'],
    ['limit', 'abc'],
  ])('rejects %s=%p with a 400', async (name, value) => {
    await expect(parse({ [name]: value })).rejects.toBeInstanceOf(BadRequestException);
  });
});
