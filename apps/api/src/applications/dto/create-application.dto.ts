import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { IsCalendarDate } from '../../common/validation/is-calendar-date.decorator';
import { IsNotFutureDate } from '../../common/validation/is-not-future-date.decorator';
import { trim, trimToNull } from '../../common/validation/trim.transform';
import { ApplicationStatus, ContractType, Priority, WorkMode } from '../../generated/prisma/enums';
import { SalaryDto } from './salary.dto';

/**
 * Body of POST /api/applications.
 * `source` and the owner are not part of it: the server sets them.
 */
export class CreateApplicationDto {
  @IsUUID()
  companyId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  position!: string;

  @IsEnum(ContractType)
  contractType!: ContractType;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string | null;

  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  jobUrl?: string | null;

  /** A date `YYYY-MM-DD`, not in the future. */
  @IsCalendarDate()
  @IsNotFutureDate()
  appliedAt!: string;

  /** The initial status of the application. */
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => SalaryDto)
  salary?: SalaryDto | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  /** NORMAL when it is left out. `null` is not accepted: a priority always has a value. */
  @ValidateIf((_application, value) => value !== undefined)
  @IsEnum(Priority)
  priority?: Priority;

  /** A date `YYYY-MM-DD`. The rule "not before the application date" is checked by the service. */
  @IsOptional()
  @IsCalendarDate()
  nextFollowUpAt?: string | null;
}
