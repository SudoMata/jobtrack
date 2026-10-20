import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { ChangeApplicationStatusDto } from './change-application-status.dto';

describe('ChangeApplicationStatusDto', () => {
  const pipe = createValidationPipe();

  function parse(body: Record<string, unknown>): Promise<ChangeApplicationStatusDto> {
    return pipe.transform(body, {
      type: 'body',
      metatype: ChangeApplicationStatusDto,
    }) as Promise<ChangeApplicationStatusDto>;
  }

  it.each(['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED'])(
    'accepts the status %s',
    async (status) => {
      await expect(parse({ status })).resolves.toMatchObject({ status });
    },
  );

  it.each([{}, { status: 'HIRED' }, { status: null }, { status: 'OFFER', userId: 'x' }])(
    'rejects %j',
    async (body) => {
      await expect(parse(body)).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
