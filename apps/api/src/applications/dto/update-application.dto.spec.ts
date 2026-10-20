import { BadRequestException } from '@nestjs/common';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { UpdateApplicationDto } from './update-application.dto';

describe('UpdateApplicationDto', () => {
  const pipe = createValidationPipe();

  function parse(body: Record<string, unknown>): Promise<UpdateApplicationDto> {
    return pipe.transform(body, {
      type: 'body',
      metatype: UpdateApplicationDto,
    }) as Promise<UpdateApplicationDto>;
  }

  async function failedFields(body: Record<string, unknown>): Promise<string[]> {
    const error: unknown = await parse(body).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse() as {
      errors: Record<string, string[]>;
    };
    return Object.keys(response.errors);
  }

  it('accepts an empty update and a partial update', async () => {
    await expect(parse({})).resolves.toBeInstanceOf(UpdateApplicationDto);
    await expect(parse({ priority: 'HIGH' })).resolves.toMatchObject({ priority: 'HIGH' });
  });

  it('refuses the status: it only changes through its own endpoint', async () => {
    await expect(failedFields({ status: 'OFFER' })).resolves.toContain('status');
  });

  it('lets a client clear the optional fields with null', async () => {
    const body = {
      location: null,
      workMode: null,
      jobUrl: null,
      salary: null,
      notes: null,
      nextFollowUpAt: null,
    };

    await expect(parse(body)).resolves.toMatchObject(body);
  });

  it.each(['companyId', 'position', 'contractType', 'appliedAt', 'priority'])(
    'refuses to clear the required field %s',
    async (field) => {
      await expect(failedFields({ [field]: null })).resolves.toContain(field);
    },
  );

  it('applies the same rules as the creation to the fields that are sent', async () => {
    await expect(failedFields({ position: '   ' })).resolves.toContain('position');
    await expect(failedFields({ companyId: 'acme' })).resolves.toContain('companyId');
    await expect(failedFields({ appliedAt: '2999-01-01' })).resolves.toContain('appliedAt');
    await expect(failedFields({ jobUrl: 'ftp://acme.com' })).resolves.toContain('jobUrl');
  });

  it('replaces the salary as a whole', async () => {
    await expect(parse({ salary: { amount: '4000', currency: 'usd' } })).resolves.toMatchObject({
      salary: { amount: '4000', currency: 'USD' },
    });
    await expect(failedFields({ salary: { amount: '4000' } })).resolves.toContain(
      'salary.currency',
    );
  });

  it('rejects fields a client must never set', async () => {
    await expect(failedFields({ userId: 'someone-else', source: 'EMAIL' })).resolves.toEqual(
      expect.arrayContaining(['userId', 'source']),
    );
  });
});
