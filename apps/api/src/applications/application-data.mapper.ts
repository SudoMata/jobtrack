import { parseCalendarDate } from '../common/dates/calendar-date';
import type { Prisma } from '../generated/prisma/client';
import { ApplicationSource } from '../generated/prisma/enums';
import { CreateApplicationDto } from './dto/create-application.dto';
import type { SalaryDto } from './dto/salary.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

/**
 * `undefined` leaves a column unchanged, `null` clears it, a salary is replaced as a whole.
 * The amount stays a text: Prisma hands it to the database as an exact decimal.
 */
function toSalaryColumns(salary: SalaryDto | null | undefined): {
  salaryAmount?: string | null;
  salaryCurrency?: string | null;
} {
  if (salary === undefined) {
    return {};
  }
  if (salary === null) {
    return { salaryAmount: null, salaryCurrency: null };
  }
  return { salaryAmount: salary.amount, salaryCurrency: salary.currency };
}

function toNullableDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseCalendarDate(value);
}

/**
 * Builds the data of a new application, together with the first line of its status history
 * (`from_status` is null). Prisma writes both in a single transaction.
 * The owner comes from the caller and `source` is always MANUAL: a client sets neither.
 */
export function toCreateData(
  userId: string,
  dto: CreateApplicationDto,
): Prisma.ApplicationUncheckedCreateInput {
  return {
    userId,
    companyId: dto.companyId,
    position: dto.position,
    contractType: dto.contractType,
    location: dto.location,
    workMode: dto.workMode,
    jobUrl: dto.jobUrl,
    appliedAt: parseCalendarDate(dto.appliedAt),
    status: dto.status,
    ...toSalaryColumns(dto.salary),
    notes: dto.notes,
    source: ApplicationSource.MANUAL,
    priority: dto.priority,
    nextFollowUpAt: toNullableDate(dto.nextFollowUpAt),
    statusHistory: {
      create: { fromStatus: null, toStatus: dto.status, changedByUserId: userId },
    },
  };
}

/** Builds the changes of an update. The status is not part of it: it has its own endpoint. */
export function toUpdateData(dto: UpdateApplicationDto): Prisma.ApplicationUncheckedUpdateInput {
  return {
    companyId: dto.companyId,
    position: dto.position,
    contractType: dto.contractType,
    location: dto.location,
    workMode: dto.workMode,
    jobUrl: dto.jobUrl,
    appliedAt: dto.appliedAt === undefined ? undefined : parseCalendarDate(dto.appliedAt),
    ...toSalaryColumns(dto.salary),
    notes: dto.notes,
    priority: dto.priority,
    nextFollowUpAt: toNullableDate(dto.nextFollowUpAt),
  };
}
