import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ListAdminUsersQueryDto } from './list-admin-users-query.dto';

describe('ListAdminUsersQueryDto', () => {
  const pipe = createValidationPipe();

  function parse(query: Record<string, string>): Promise<ListAdminUsersQueryDto> {
    return pipe.transform(query, {
      type: 'query',
      metatype: ListAdminUsersQueryDto,
    }) as Promise<ListAdminUsersQueryDto>;
  }

  it('applies the pagination defaults and no search', async () => {
    const query = await parse({});

    expect(query).toMatchObject({ page: 1, limit: 20 });
    expect(query.search).toBeUndefined();
  });

  it('trims the search', async () => {
    await expect(parse({ search: '  ada ' })).resolves.toMatchObject({ search: 'ada' });
  });

  it('rejects a search longer than 100 characters', async () => {
    await expect(parse({ search: 'a'.repeat(101) })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the pagination rules of its parent', async () => {
    await expect(parse({ limit: '101' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects the parameters the endpoint does not support', async () => {
    await expect(parse({ role: 'ADMIN' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
