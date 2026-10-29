import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { AdminStatsQueryDto } from './admin-stats-query.dto';

describe('AdminStatsQueryDto', () => {
  const pipe = createValidationPipe();

  function parse(query: Record<string, string>): Promise<AdminStatsQueryDto> {
    return pipe.transform(query, {
      type: 'query',
      metatype: AdminStatsQueryDto,
    }) as Promise<AdminStatsQueryDto>;
  }

  it('uses 30 days when no period is given', async () => {
    await expect(parse({})).resolves.toMatchObject({ period: '30d' });
  });

  it.each(['7d', '30d', '90d'])('accepts the period %s', async (period) => {
    await expect(parse({ period })).resolves.toMatchObject({ period });
  });

  it.each(['1d', '7', '365d', '', 'week', '30D'])('rejects the period %p', async (period) => {
    await expect(parse({ period })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown query parameters', async () => {
    await expect(parse({ from: '2026-01-01' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
