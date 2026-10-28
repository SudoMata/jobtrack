import { Prisma } from '../generated/prisma/client';
import {
  ApplicationSource,
  ApplicationStatus,
  ContractType,
  Priority,
} from '../generated/prisma/enums';
import type { ApplicationWithCompany } from './application-with-company';
import { toApplicationResponse } from './application-response.mapper';

function buildApplication(overrides: Partial<ApplicationWithCompany> = {}): ApplicationWithCompany {
  return {
    id: '5b0c8f4e-7a1d-4e2b-9c3a-6d8e1f2a3b4c',
    userId: '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60',
    companyId: '9a1d7e52-2c3b-4f08-8e6a-0d5b7c4a1e93',
    position: 'Developer',
    contractType: ContractType.FULL_TIME,
    location: 'Kinshasa',
    workMode: null,
    jobUrl: null,
    appliedAt: new Date('2026-10-01T00:00:00.000Z'),
    status: ApplicationStatus.APPLIED,
    salaryAmount: null,
    salaryCurrency: null,
    notes: null,
    source: ApplicationSource.MANUAL,
    priority: Priority.NORMAL,
    nextFollowUpAt: null,
    createdAt: new Date('2026-10-01T08:00:00.000Z'),
    updatedAt: new Date('2026-10-01T08:00:00.000Z'),
    company: { id: '9a1d7e52-2c3b-4f08-8e6a-0d5b7c4a1e93', name: 'Acme' },
    ...overrides,
  };
}

describe('toApplicationResponse', () => {
  it('returns the public fields with the company, and neither the owner nor the company id', () => {
    const response = toApplicationResponse(buildApplication());

    expect(response).toEqual({
      id: '5b0c8f4e-7a1d-4e2b-9c3a-6d8e1f2a3b4c',
      company: { id: '9a1d7e52-2c3b-4f08-8e6a-0d5b7c4a1e93', name: 'Acme' },
      position: 'Developer',
      contractType: 'FULL_TIME',
      location: 'Kinshasa',
      workMode: null,
      jobUrl: null,
      appliedAt: '2026-10-01',
      status: 'APPLIED',
      salary: null,
      notes: null,
      source: 'MANUAL',
      priority: 'NORMAL',
      nextFollowUpAt: null,
      createdAt: new Date('2026-10-01T08:00:00.000Z'),
      updatedAt: new Date('2026-10-01T08:00:00.000Z'),
    });
    expect(response).not.toHaveProperty('userId');
    expect(response).not.toHaveProperty('companyId');
  });

  it('writes the salary as an exact decimal text with two decimals', () => {
    const whole = toApplicationResponse(
      buildApplication({ salaryAmount: new Prisma.Decimal('3500'), salaryCurrency: 'USD' }),
    );
    const cents = toApplicationResponse(
      buildApplication({ salaryAmount: new Prisma.Decimal('1234.5'), salaryCurrency: 'EUR' }),
    );

    expect(whole.salary).toEqual({ amount: '3500.00', currency: 'USD' });
    expect(cents.salary).toEqual({ amount: '1234.50', currency: 'EUR' });
  });

  it('writes the follow-up date as YYYY-MM-DD', () => {
    const response = toApplicationResponse(
      buildApplication({ nextFollowUpAt: new Date('2026-10-20T00:00:00.000Z') }),
    );

    expect(response.nextFollowUpAt).toBe('2026-10-20');
  });
});
