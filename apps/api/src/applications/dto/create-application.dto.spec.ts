import { BadRequestException } from '@nestjs/common';
import {
  formatCalendarDate,
  latestCalendarDateOnEarth,
  parseCalendarDate,
} from '../../common/dates/calendar-date';
import { createValidationPipe } from '../../common/validation/create-validation-pipe';
import { CreateApplicationDto } from './create-application.dto';

const COMPANY_ID = '9a1d7e52-2c3b-4f08-8e6a-0d5b7c4a1e93';

const VALID = {
  companyId: COMPANY_ID,
  position: 'Backend developer',
  contractType: 'FULL_TIME',
  appliedAt: '2026-10-01',
  status: 'APPLIED',
};

describe('CreateApplicationDto', () => {
  const pipe = createValidationPipe();

  const valid = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    ...VALID,
    ...overrides,
  });

  function parse(body: Record<string, unknown>): Promise<CreateApplicationDto> {
    return pipe.transform(body, {
      type: 'body',
      metatype: CreateApplicationDto,
    }) as Promise<CreateApplicationDto>;
  }

  async function failedFields(body: Record<string, unknown>): Promise<string[]> {
    const error: unknown = await parse(body).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    const response = (error as BadRequestException).getResponse() as {
      errors: Record<string, string[]>;
    };
    return Object.keys(response.errors);
  }

  const dayAfterLatestDate = (): string =>
    formatCalendarDate(
      new Date(parseCalendarDate(latestCalendarDateOnEarth()).getTime() + 86_400_000),
    );

  describe('valid payloads', () => {
    it('accepts the required fields alone', async () => {
      await expect(parse(valid())).resolves.toMatchObject({
        position: 'Backend developer',
        contractType: 'FULL_TIME',
        status: 'APPLIED',
      });
    });

    it('accepts a complete payload', async () => {
      const body = valid({
        location: 'Kinshasa',
        workMode: 'HYBRID',
        jobUrl: 'https://acme.com/jobs/1',
        salary: { amount: '3500.00', currency: 'USD' },
        notes: 'Referred by Alice',
        priority: 'HIGH',
        nextFollowUpAt: '2026-10-10',
      });

      await expect(parse(body)).resolves.toMatchObject({
        location: 'Kinshasa',
        workMode: 'HYBRID',
        salary: { amount: '3500.00', currency: 'USD' },
        priority: 'HIGH',
        nextFollowUpAt: '2026-10-10',
      });
    });

    it('trims the texts and turns blank optional texts into null', async () => {
      const body = valid({ position: '  Developer  ', location: '   ', jobUrl: '', notes: ' ' });

      await expect(parse(body)).resolves.toMatchObject({
        position: 'Developer',
        location: null,
        jobUrl: null,
        notes: null,
      });
    });

    it('converts the currency to uppercase', async () => {
      const body = valid({ salary: { amount: '100', currency: ' eur ' } });

      await expect(parse(body)).resolves.toMatchObject({ salary: { currency: 'EUR' } });
    });

    it('accepts a salary set to null', async () => {
      await expect(parse(valid({ salary: null }))).resolves.toMatchObject({ salary: null });
    });
  });

  describe('required fields and values', () => {
    it('rejects a payload that misses the required fields', async () => {
      await expect(failedFields({})).resolves.toEqual(
        expect.arrayContaining(['companyId', 'position', 'contractType', 'appliedAt', 'status']),
      );
    });

    it('rejects a company id that is not a UUID', async () => {
      await expect(failedFields(valid({ companyId: 'acme' }))).resolves.toContain('companyId');
    });

    it('rejects a blank or too long position', async () => {
      await expect(failedFields(valid({ position: '   ' }))).resolves.toContain('position');
      await expect(failedFields(valid({ position: 'a'.repeat(151) }))).resolves.toContain(
        'position',
      );
    });

    it.each([
      ['contractType', 'FREELANCER'],
      ['status', 'HIRED'],
      ['workMode', 'OFFICE'],
      ['priority', 'URGENT'],
    ])('rejects %s=%p', async (field, value) => {
      await expect(failedFields(valid({ [field]: value }))).resolves.toContain(field);
    });

    it('rejects a priority set to null', async () => {
      await expect(failedFields(valid({ priority: null }))).resolves.toContain('priority');
    });

    it('rejects a job URL that is not http or https', async () => {
      await expect(failedFields(valid({ jobUrl: 'javascript:alert(1)' }))).resolves.toContain(
        'jobUrl',
      );
    });

    it('rejects notes longer than 5000 characters', async () => {
      await expect(failedFields(valid({ notes: 'a'.repeat(5001) }))).resolves.toContain('notes');
    });
  });

  describe('dates', () => {
    it.each(['2026-02-31', '15/10/2026', '2026-10-01T10:00:00Z', 'tomorrow', ''])(
      'rejects the application date %p',
      async (appliedAt) => {
        await expect(failedFields(valid({ appliedAt }))).resolves.toContain('appliedAt');
      },
    );

    it('accepts the latest calendar date that exists on Earth', async () => {
      await expect(parse(valid({ appliedAt: latestCalendarDateOnEarth() }))).resolves.toBeDefined();
    });

    it('rejects the day after it, and any date far in the future', async () => {
      await expect(failedFields(valid({ appliedAt: dayAfterLatestDate() }))).resolves.toContain(
        'appliedAt',
      );
      await expect(failedFields(valid({ appliedAt: '2999-01-01' }))).resolves.toContain(
        'appliedAt',
      );
    });

    it('rejects a follow-up date that is not a calendar date', async () => {
      await expect(failedFields(valid({ nextFollowUpAt: '10/10/2026' }))).resolves.toContain(
        'nextFollowUpAt',
      );
    });
  });

  describe('salary', () => {
    it.each(['0', '3500', '3500.5', '3500.50', '9999999999.99'])(
      'accepts the amount %p',
      async (amount) => {
        await expect(parse(valid({ salary: { amount, currency: 'USD' } }))).resolves.toMatchObject({
          salary: { amount },
        });
      },
    );

    it.each(['-5', '1,5', '12.345', '12345678901', '', ' ', 'abc'])(
      'rejects the amount %p',
      async (amount) => {
        await expect(
          failedFields(valid({ salary: { amount, currency: 'USD' } })),
        ).resolves.toContain('salary.amount');
      },
    );

    it('rejects an amount sent as a number', async () => {
      await expect(
        failedFields(valid({ salary: { amount: 3500, currency: 'USD' } })),
      ).resolves.toContain('salary.amount');
    });

    it.each(['US', 'USDX', '12A', ''])('rejects the currency %p', async (currency) => {
      await expect(failedFields(valid({ salary: { amount: '100', currency } }))).resolves.toContain(
        'salary.currency',
      );
    });

    it('rejects a salary that has no currency, or no amount', async () => {
      await expect(failedFields(valid({ salary: { amount: '100' } }))).resolves.toContain(
        'salary.currency',
      );
      await expect(failedFields(valid({ salary: { currency: 'USD' } }))).resolves.toContain(
        'salary.amount',
      );
    });
  });

  it('rejects fields a client must never set', async () => {
    await expect(
      failedFields(valid({ userId: 'someone-else', source: 'EMAIL', id: 'x' })),
    ).resolves.toEqual(expect.arrayContaining(['userId', 'source', 'id']));
  });
});
