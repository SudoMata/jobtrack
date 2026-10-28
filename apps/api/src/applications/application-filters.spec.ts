import { buildApplicationWhere } from './application-filters';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';

const USER_ID = '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60';

function query(fields: Partial<ListApplicationsQueryDto> = {}): ListApplicationsQueryDto {
  return Object.assign(new ListApplicationsQueryDto(), fields);
}

describe('buildApplicationWhere', () => {
  it('only filters by owner when nothing else is asked', () => {
    expect(buildApplicationWhere(USER_ID, query())).toEqual({ userId: USER_ID });
  });

  it('adds every filter next to the owner', () => {
    const where = buildApplicationWhere(
      USER_ID,
      query({
        status: 'INTERVIEW',
        contractType: 'FULL_TIME',
        workMode: 'REMOTE',
        priority: 'HIGH',
        location: 'Kinshasa',
      }),
    );

    expect(where).toEqual({
      userId: USER_ID,
      status: 'INTERVIEW',
      contractType: 'FULL_TIME',
      workMode: 'REMOTE',
      priority: 'HIGH',
      location: { contains: 'Kinshasa', mode: 'insensitive' },
    });
  });

  it('searches the position or the company name, without caring about the case', () => {
    const where = buildApplicationWhere(USER_ID, query({ search: 'acme' }));

    expect(where).toEqual({
      userId: USER_ID,
      OR: [
        { position: { contains: 'acme', mode: 'insensitive' } },
        { company: { name: { contains: 'acme', mode: 'insensitive' } } },
      ],
    });
  });

  it('ignores a blank search and a blank location', () => {
    expect(buildApplicationWhere(USER_ID, query({ search: '', location: '' }))).toEqual({
      userId: USER_ID,
    });
  });

  it('keeps the owner when every filter and the search are combined', () => {
    const where = buildApplicationWhere(
      USER_ID,
      query({ search: 'dev', status: 'OFFER', priority: 'LOW' }),
    );

    expect(where.userId).toBe(USER_ID);
    expect(where.status).toBe('OFFER');
    expect(where.priority).toBe('LOW');
    expect(where.OR).toHaveLength(2);
  });
});
