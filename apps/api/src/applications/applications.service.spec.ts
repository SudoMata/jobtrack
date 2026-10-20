import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import {
  ApplicationSource,
  ApplicationStatus,
  ContractType,
  Priority,
} from '../generated/prisma/enums';
import type { PrismaService } from '../prisma/prisma.service';
import type { ApplicationWithCompany } from './application-with-company';
import { ApplicationsService } from './applications.service';
import { ChangeApplicationStatusDto } from './dto/change-application-status.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

const USER_ID = '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60';
const APPLICATION_ID = '5b0c8f4e-7a1d-4e2b-9c3a-6d8e1f2a3b4c';
const COMPANY_ID = '9a1d7e52-2c3b-4f08-8e6a-0d5b7c4a1e93';

function buildApplication(): ApplicationWithCompany {
  return {
    id: APPLICATION_ID,
    userId: USER_ID,
    companyId: COMPANY_ID,
    position: 'Developer',
    contractType: ContractType.FULL_TIME,
    location: null,
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
    createdAt: new Date(),
    updatedAt: new Date(),
    company: { id: COMPANY_ID, name: 'Acme' },
  };
}

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('failure', { code, clientVersion: 'test' });
}

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

function statusDto(status: ApplicationStatus): ChangeApplicationStatusDto {
  return Object.assign(new ChangeApplicationStatusDto(), { status });
}

describe('ApplicationsService', () => {
  const create = jest.fn();
  const findFirstOrThrow = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const transaction = jest.fn();

  const txFindFirstOrThrow = jest.fn();
  const txUpdateMany = jest.fn();
  const txCreateHistory = jest.fn();
  const tx = {
    application: { findFirstOrThrow: txFindFirstOrThrow, updateMany: txUpdateMany },
    applicationStatusHistory: { create: txCreateHistory },
  };

  let service: ApplicationsService;

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx));
    service = new ApplicationsService({
      application: { create, findFirstOrThrow, update, delete: remove },
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates the application and the first line of its history in one write', async () => {
      const application = buildApplication();
      create.mockResolvedValue(application);

      await expect(service.create(USER_ID, createDto())).resolves.toBe(application);

      expect(create).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_ID,
          companyId: COMPANY_ID,
          source: ApplicationSource.MANUAL,
          statusHistory: {
            create: { fromStatus: null, toStatus: 'APPLIED', changedByUserId: USER_ID },
          },
        }),
        include: { company: { select: { id: true, name: true } } },
      });
    });

    it('refuses a follow-up before the application date without writing anything', async () => {
      const dto = createDto({ appliedAt: '2026-10-10', nextFollowUpAt: '2026-10-09' });

      await expect(service.create(USER_ID, dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    });

    it('reports a company that is unknown or belongs to someone else as an error on companyId', async () => {
      create.mockRejectedValue(prismaError('P2003'));

      const error: unknown = await service.create(USER_ID, createDto()).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        errors: { companyId: ['Company not found'] },
      });
    });

    it('lets any other error through', async () => {
      create.mockRejectedValue(new Error('connection lost'));

      await expect(service.create(USER_ID, createDto())).rejects.toThrow('connection lost');
    });
  });

  describe('findOne', () => {
    it('looks the application up by id and by owner together, with its company', async () => {
      const application = buildApplication();
      findFirstOrThrow.mockResolvedValue(application);

      await expect(service.findOne(USER_ID, APPLICATION_ID)).resolves.toBe(application);

      expect(findFirstOrThrow).toHaveBeenCalledWith({
        where: { id: APPLICATION_ID, userId: USER_ID },
        include: { company: { select: { id: true, name: true } } },
      });
    });

    it('answers 404 for an application that does not exist or belongs to someone else', async () => {
      findFirstOrThrow.mockRejectedValue(prismaError('P2025'));

      await expect(service.findOne(USER_ID, APPLICATION_ID)).rejects.toThrow(
        new NotFoundException('Application not found'),
      );
    });
  });

  describe('update', () => {
    it('updates by id and by owner together, without reading when no date is touched', async () => {
      const application = buildApplication();
      update.mockResolvedValue(application);

      await expect(
        service.update(USER_ID, APPLICATION_ID, updateDto({ priority: 'HIGH' })),
      ).resolves.toBe(application);

      expect(findFirstOrThrow).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith({
        where: { id: APPLICATION_ID, userId: USER_ID },
        data: { priority: 'HIGH' },
        include: { company: { select: { id: true, name: true } } },
      });
    });

    it('checks a new follow-up date against the stored application date', async () => {
      findFirstOrThrow.mockResolvedValue({
        appliedAt: new Date('2026-10-10T00:00:00.000Z'),
        nextFollowUpAt: null,
      });

      await expect(
        service.update(USER_ID, APPLICATION_ID, updateDto({ nextFollowUpAt: '2026-10-09' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it('checks a new application date against the stored follow-up date', async () => {
      findFirstOrThrow.mockResolvedValue({
        appliedAt: new Date('2026-10-01T00:00:00.000Z'),
        nextFollowUpAt: new Date('2026-10-20T00:00:00.000Z'),
      });

      await expect(
        service.update(USER_ID, APPLICATION_ID, updateDto({ appliedAt: '2026-10-25' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it('accepts dates that are consistent with the stored ones', async () => {
      findFirstOrThrow.mockResolvedValue({
        appliedAt: new Date('2026-10-01T00:00:00.000Z'),
        nextFollowUpAt: new Date('2026-10-20T00:00:00.000Z'),
      });
      update.mockResolvedValue(buildApplication());

      await expect(
        service.update(USER_ID, APPLICATION_ID, updateDto({ appliedAt: '2026-10-05' })),
      ).resolves.toBeDefined();
    });

    it('lets a client clear the follow-up date', async () => {
      findFirstOrThrow.mockResolvedValue({
        appliedAt: new Date('2026-10-01T00:00:00.000Z'),
        nextFollowUpAt: new Date('2026-10-20T00:00:00.000Z'),
      });
      update.mockResolvedValue(buildApplication());

      await expect(
        service.update(USER_ID, APPLICATION_ID, updateDto({ nextFollowUpAt: null })),
      ).resolves.toBeDefined();
    });

    it('answers 404 for an application that does not exist or belongs to someone else', async () => {
      update.mockRejectedValue(prismaError('P2025'));

      await expect(
        service.update(USER_ID, APPLICATION_ID, updateDto({ priority: 'HIGH' })),
      ).rejects.toThrow(new NotFoundException('Application not found'));
    });

    it('reports a company that is unknown or belongs to someone else as an error on companyId', async () => {
      update.mockRejectedValue(prismaError('P2003'));

      await expect(
        service.update(USER_ID, APPLICATION_ID, updateDto({ companyId: COMPANY_ID })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes by id and by owner together', async () => {
      remove.mockResolvedValue(buildApplication());

      await expect(service.remove(USER_ID, APPLICATION_ID)).resolves.toBeUndefined();

      expect(remove).toHaveBeenCalledWith({ where: { id: APPLICATION_ID, userId: USER_ID } });
    });

    it('answers 404 for an application that does not exist or belongs to someone else', async () => {
      remove.mockRejectedValue(prismaError('P2025'));

      await expect(service.remove(USER_ID, APPLICATION_ID)).rejects.toThrow(
        new NotFoundException('Application not found'),
      );
    });
  });

  describe('changeStatus', () => {
    it('changes the status and records the change in the history, in one transaction', async () => {
      const updated = { ...buildApplication(), status: ApplicationStatus.OFFER };
      txFindFirstOrThrow
        .mockResolvedValueOnce({ status: ApplicationStatus.APPLIED })
        .mockResolvedValueOnce(updated);
      txUpdateMany.mockResolvedValue({ count: 1 });
      txCreateHistory.mockResolvedValue({});

      await expect(service.changeStatus(USER_ID, APPLICATION_ID, statusDto('OFFER'))).resolves.toBe(
        updated,
      );

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(txUpdateMany).toHaveBeenCalledWith({
        where: { id: APPLICATION_ID, userId: USER_ID, status: 'APPLIED' },
        data: { status: 'OFFER' },
      });
      expect(txCreateHistory).toHaveBeenCalledWith({
        data: {
          applicationId: APPLICATION_ID,
          fromStatus: 'APPLIED',
          toStatus: 'OFFER',
          changedByUserId: USER_ID,
        },
      });
    });

    it('answers 409 when the application already has the requested status, and writes nothing', async () => {
      txFindFirstOrThrow.mockResolvedValue({ status: ApplicationStatus.OFFER });

      await expect(
        service.changeStatus(USER_ID, APPLICATION_ID, statusDto('OFFER')),
      ).rejects.toThrow(new ConflictException('The application already has this status'));

      expect(txUpdateMany).not.toHaveBeenCalled();
      expect(txCreateHistory).not.toHaveBeenCalled();
    });

    it('answers 409 when the status was changed by another request in the meantime, and records nothing', async () => {
      txFindFirstOrThrow.mockResolvedValue({ status: ApplicationStatus.APPLIED });
      txUpdateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.changeStatus(USER_ID, APPLICATION_ID, statusDto('OFFER')),
      ).rejects.toThrow(
        new ConflictException('The application status was changed in the meantime'),
      );

      expect(txCreateHistory).not.toHaveBeenCalled();
    });

    it('answers 404 for an application that does not exist or belongs to someone else', async () => {
      txFindFirstOrThrow.mockRejectedValue(prismaError('P2025'));

      await expect(
        service.changeStatus(USER_ID, APPLICATION_ID, statusDto('OFFER')),
      ).rejects.toThrow(new NotFoundException('Application not found'));

      expect(txUpdateMany).not.toHaveBeenCalled();
    });
  });
});
