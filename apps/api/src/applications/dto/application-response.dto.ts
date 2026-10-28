import {
  ApplicationSource,
  ApplicationStatus,
  ContractType,
  Priority,
  WorkMode,
} from '../../generated/prisma/enums';
import { ApplicationCompanyResponseDto } from './application-company-response.dto';
import { SalaryResponseDto } from './salary-response.dto';

/** An application as the API returns it. The owner is never part of it. */
export class ApplicationResponseDto {
  id!: string;
  company!: ApplicationCompanyResponseDto;
  position!: string;
  contractType!: ContractType;
  location!: string | null;
  workMode!: WorkMode | null;
  jobUrl!: string | null;

  /** A date `YYYY-MM-DD`. */
  appliedAt!: string;

  status!: ApplicationStatus;
  salary!: SalaryResponseDto | null;
  notes!: string | null;
  source!: ApplicationSource;
  priority!: Priority;

  /** A date `YYYY-MM-DD`. */
  nextFollowUpAt!: string | null;

  createdAt!: Date;
  updatedAt!: Date;
}
