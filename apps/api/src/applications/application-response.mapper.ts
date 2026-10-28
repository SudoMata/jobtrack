import { formatCalendarDate } from '../common/dates/calendar-date';
import type { ApplicationWithCompany } from './application-with-company';
import { ApplicationResponseDto } from './dto/application-response.dto';

/** Copies the public fields one by one: a column added to the table later is not exposed by accident. */
export function toApplicationResponse(application: ApplicationWithCompany): ApplicationResponseDto {
  const { salaryAmount, salaryCurrency } = application;

  return {
    id: application.id,
    company: { id: application.company.id, name: application.company.name },
    position: application.position,
    contractType: application.contractType,
    location: application.location,
    workMode: application.workMode,
    jobUrl: application.jobUrl,
    appliedAt: formatCalendarDate(application.appliedAt),
    status: application.status,
    // The database guarantees that the amount and the currency are both set or both empty.
    salary:
      salaryAmount !== null && salaryCurrency !== null
        ? { amount: salaryAmount.toFixed(2), currency: salaryCurrency }
        : null,
    notes: application.notes,
    source: application.source,
    priority: application.priority,
    nextFollowUpAt: application.nextFollowUpAt
      ? formatCalendarDate(application.nextFollowUpAt)
      : null,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}
