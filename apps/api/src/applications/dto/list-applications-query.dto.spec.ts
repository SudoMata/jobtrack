import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ListApplicationsQueryDto } from './list-applications-query.dto';

describe('ListApplicationsQueryDto', () => {
  const pipe = createValidationPipe();

  function parse(query: Record<string, string>): Promise<ListApplicationsQueryDto> {
    return pipe.transform(query, {
      type: 'query',
      metatype: ListApplicationsQueryDto,
    }) as Promise<ListApplicationsQueryDto>;
  }

  it('applies the defaults: first page, 20 items, newest application first, no filter', async () => {
    const query = await parse({});

    expect(query).toMatchObject({ page: 1, limit: 20, sort: 'appliedAt_desc' });
    expect(query.search).toBeUndefined();
    expect(query.status).toBeUndefined();
  });

  it('reads every filter, the search and the sort', async () => {
    const query = await parse({
      search: '  acme ',
      status: 'INTERVIEW',
      contractType: 'FULL_TIME',
      location: ' Kinshasa ',
      workMode: 'REMOTE',
      priority: 'HIGH',
      sort: 'appliedAt_asc',
      page: '2',
      limit: '50',
    });

    expect(query).toMatchObject({
      search: 'acme',
      status: 'INTERVIEW',
      contractType: 'FULL_TIME',
      location: 'Kinshasa',
      workMode: 'REMOTE',
      priority: 'HIGH',
      sort: 'appliedAt_asc',
      page: 2,
      limit: 50,
    });
  });

  it.each([
    ['status', 'HIRED'],
    ['contractType', 'FREELANCER'],
    ['workMode', 'OFFICE'],
    ['priority', 'URGENT'],
    ['sort', 'company_asc'],
    ['sort', 'appliedAt'],
    ['search', 'a'.repeat(101)],
    ['location', 'a'.repeat(151)],
    ['limit', '101'],
    ['page', '0'],
  ])('rejects %s=%p', async (name, value) => {
    await expect(parse({ [name]: value })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown query parameters', async () => {
    await expect(parse({ userId: 'someone-else' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
