import { ApplicationSource } from '../generated/prisma/enums';
import { toCreateData, toUpdateData } from './application-data.mapper';
import { CreateApplicationDto } from './dto/create-application.dto';
import { SalaryDto } from './dto/salary.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

const USER_ID = '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60';
const COMPANY_ID = '9a1d7e52-2c3b-4f08-8e6a-0d5b7c4a1e93';

function createDto(fields: Partial<CreateApplicationDto> = {}): CreateApplicationDto {
  return Object.assign(new CreateApplicationDto(), {
    companyId: COMPANY_ID,
    position: 'Developer',
    contractType: 'FULL_TIME',
    appliedAt: '2026-10-01',
    status: 'APPLIED',
    ...fields,
  });
}

function updateDto(fields: Partial<UpdateApplicationDto>): UpdateApplicationDto {
  return Object.assign(new UpdateApplicationDto(), fields);
}

function salary(amount: string, currency: string): SalaryDto {
  return Object.assign(new SalaryDto(), { amount, currency });
}

describe('toCreateData', () => {
  it('sets the owner and the source itself, and writes the first line of the history', () => {
    expect(toCreateData(USER_ID, createDto({ status: 'INTERVIEW' }))).toEqual({
      userId: USER_ID,
      companyId: COMPANY_ID,
      position: 'Developer',
      contractType: 'FULL_TIME',
      appliedAt: new Date('2026-10-01T00:00:00.000Z'),
      status: 'INTERVIEW',
      source: ApplicationSource.MANUAL,
      statusHistory: {
        create: { fromStatus: null, toStatus: 'INTERVIEW', changedByUserId: USER_ID },
      },
    });
  });

  it('turns the salary object into the two columns', () => {
    const data = toCreateData(USER_ID, createDto({ salary: salary('3500.00', 'USD') }));

    expect(data).toMatchObject({ salaryAmount: '3500.00', salaryCurrency: 'USD' });
  });

  it('leaves the salary columns out when there is no salary', () => {
    const data = toCreateData(USER_ID, createDto({ salary: null }));

    expect(data).toMatchObject({ salaryAmount: null, salaryCurrency: null });
    expect(toCreateData(USER_ID, createDto())).not.toHaveProperty('salaryAmount');
  });

  it('converts the follow-up date and keeps the optional fields', () => {
    const data = toCreateData(
      USER_ID,
      createDto({
        nextFollowUpAt: '2026-10-10',
        location: 'Kinshasa',
        workMode: 'HYBRID',
        priority: 'HIGH',
      }),
    );

    expect(data).toMatchObject({
      nextFollowUpAt: new Date('2026-10-10T00:00:00.000Z'),
      location: 'Kinshasa',
      workMode: 'HYBRID',
      priority: 'HIGH',
    });
  });
});

describe('toUpdateData', () => {
  it('only carries the fields that were sent', () => {
    expect(toUpdateData(updateDto({ priority: 'HIGH' }))).toEqual({ priority: 'HIGH' });
  });

  it('never carries a status', () => {
    expect(toUpdateData(updateDto({ priority: 'HIGH' }))).not.toHaveProperty('status');
  });

  it('clears the optional fields with null', () => {
    const data = toUpdateData(
      updateDto({
        location: null,
        workMode: null,
        jobUrl: null,
        notes: null,
        nextFollowUpAt: null,
        salary: null,
      }),
    );

    expect(data).toEqual({
      location: null,
      workMode: null,
      jobUrl: null,
      notes: null,
      nextFollowUpAt: null,
      salaryAmount: null,
      salaryCurrency: null,
    });
  });

  it('replaces the salary as a whole', () => {
    expect(toUpdateData(updateDto({ salary: salary('4000', 'EUR') }))).toEqual({
      salaryAmount: '4000',
      salaryCurrency: 'EUR',
    });
  });

  it('converts the dates and can change the company', () => {
    expect(
      toUpdateData(
        updateDto({ appliedAt: '2026-10-02', nextFollowUpAt: '2026-10-20', companyId: COMPANY_ID }),
      ),
    ).toEqual({
      appliedAt: new Date('2026-10-02T00:00:00.000Z'),
      nextFollowUpAt: new Date('2026-10-20T00:00:00.000Z'),
      companyId: COMPANY_ID,
    });
  });
});
