import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ListCompaniesQueryDto } from './list-companies-query.dto';

describe('ListCompaniesQueryDto', () => {
  const pipe = createValidationPipe();

  function parse(query: Record<string, string>): Promise<ListCompaniesQueryDto> {
    return pipe.transform(query, {
      type: 'query',
      metatype: ListCompaniesQueryDto,
    }) as Promise<ListCompaniesQueryDto>;
  }

  it('applies the pagination defaults and no search', async () => {
    const query = await parse({});

    expect(query).toMatchObject({ page: 1, limit: 20 });
    expect(query.search).toBeUndefined();
  });

  it('trims the search', async () => {
    await expect(parse({ search: '  acme ' })).resolves.toMatchObject({ search: 'acme' });
  });

  it('rejects a search longer than 100 characters', async () => {
    await expect(parse({ search: 'a'.repeat(101) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the pagination rules of its parent', async () => {
    await expect(parse({ limit: '101' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown query parameters', async () => {
    await expect(parse({ userId: 'someone-else' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
