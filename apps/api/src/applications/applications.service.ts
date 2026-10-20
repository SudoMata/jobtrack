import { ConflictException, Injectable } from '@nestjs/common';
import { formatCalendarDate } from '../common/dates/calendar-date';
import { orNotFound } from '../common/errors/or-not-found';
import { hasPrismaErrorCode, PrismaErrorCode } from '../common/errors/prisma-errors';
import { fieldError } from '../common/validation/field-error';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationWithCompany, WITH_COMPANY } from './application-with-company';
import { toCreateData, toUpdateData } from './application-data.mapper';
import { assertFollowUpNotBeforeApplication } from './assert-follow-up-date';
import { ChangeApplicationStatusDto } from './dto/change-application-status.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

const APPLICATION = 'Application';

/**
 * Applications belong to one user. Every method takes the owner's id first and every
 * query is filtered by it, exactly like companies (TECHNICAL_SPEC.md, sections 15 and 28).
 */
@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateApplicationDto): Promise<ApplicationWithCompany> {
    assertFollowUpNotBeforeApplication(dto.appliedAt, dto.nextFollowUpAt);

    return this.rejectUnknownCompany(
      this.prisma.application.create({ data: toCreateData(userId, dto), include: WITH_COMPANY }),
    );
  }

  findOne(userId: string, id: string): Promise<ApplicationWithCompany> {
    return orNotFound(
      this.prisma.application.findFirstOrThrow({ where: { id, userId }, include: WITH_COMPANY }),
      APPLICATION,
    );
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateApplicationDto,
  ): Promise<ApplicationWithCompany> {
    await this.checkDates(userId, id, dto);

    return this.rejectUnknownCompany(
      orNotFound(
        this.prisma.application.update({
          where: { id, userId },
          data: toUpdateData(dto),
          include: WITH_COMPANY,
        }),
        APPLICATION,
      ),
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    // The status history is deleted with the application (cascade defined in the database).
    await orNotFound(this.prisma.application.delete({ where: { id, userId } }), APPLICATION);
  }

  /**
   * Changes the status and records the change in the history, in one transaction.
   * The status is only written if it is still the one that was read: if another request
   * changed it in the meantime, this one is refused rather than writing a history line
   * whose `from_status` would not match reality.
   */
  changeStatus(
    userId: string,
    id: string,
    dto: ChangeApplicationStatusDto,
  ): Promise<ApplicationWithCompany> {
    return this.prisma.$transaction(async (tx) => {
      const current = await orNotFound(
        tx.application.findFirstOrThrow({ where: { id, userId }, select: { status: true } }),
        APPLICATION,
      );

      if (current.status === dto.status) {
        throw new ConflictException('The application already has this status');
      }

      const { count } = await tx.application.updateMany({
        where: { id, userId, status: current.status },
        data: { status: dto.status },
      });
      if (count === 0) {
        throw new ConflictException('The application status was changed in the meantime');
      }

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: id,
          fromStatus: current.status,
          toStatus: dto.status,
          changedByUserId: userId,
        },
      });

      return tx.application.findFirstOrThrow({ where: { id, userId }, include: WITH_COMPANY });
    });
  }

  /**
   * "Not before the application date" needs the stored dates when only one of the two is sent.
   * Nothing is read when the update touches neither date.
   */
  private async checkDates(userId: string, id: string, dto: UpdateApplicationDto): Promise<void> {
    if (dto.appliedAt === undefined && dto.nextFollowUpAt === undefined) {
      return;
    }

    const current = await orNotFound(
      this.prisma.application.findFirstOrThrow({
        where: { id, userId },
        select: { appliedAt: true, nextFollowUpAt: true },
      }),
      APPLICATION,
    );

    const storedFollowUp = current.nextFollowUpAt
      ? formatCalendarDate(current.nextFollowUpAt)
      : null;

    assertFollowUpNotBeforeApplication(
      dto.appliedAt ?? formatCalendarDate(current.appliedAt),
      dto.nextFollowUpAt === undefined ? storedFollowUp : dto.nextFollowUpAt,
    );
  }

  /**
   * A company that does not exist, or that belongs to someone else, is refused by the
   * composite foreign key of the database. It is reported as an error on `companyId`,
   * identical in both cases so that nothing is revealed (decision D45).
   */
  private async rejectUnknownCompany<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      if (hasPrismaErrorCode(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw fieldError('companyId', 'Company not found');
      }
      throw error;
    }
  }
}
