import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ChangeUserStatusDto } from './change-user-status.dto';

describe('ChangeUserStatusDto', () => {
  const pipe = createValidationPipe();

  function parse(body: Record<string, unknown>): Promise<ChangeUserStatusDto> {
    return pipe.transform(body, {
      type: 'body',
      metatype: ChangeUserStatusDto,
    }) as Promise<ChangeUserStatusDto>;
  }

  it.each(['ACTIVE', 'SUSPENDED'])('accepts the status %s', async (status) => {
    await expect(parse({ status })).resolves.toMatchObject({ status });
  });

  it.each([
    {},
    { status: 'BANNED' },
    { status: 'active' },
    { status: null },
    { status: 'ACTIVE', role: 'ADMIN' },
  ])('rejects %j', async (body) => {
    await expect(parse(body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
