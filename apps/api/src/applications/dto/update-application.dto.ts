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
import { ContractType, Priority, WorkMode } from '../../generated/prisma/enums';
import { SalaryDto } from './salary.dto';

/**
 * Body of PATCH /api/applications/:id.
 *
 * A field that is not sent is left unchanged. Optional fields (location, work mode,
 * job URL, salary, notes, follow-up date) are cleared with `null`; required fields
 * can be changed but never cleared. The status is not part of this body: it only
 * changes through PATCH /api/applications/:id/status, so that every change is recorded
 * in the status history (decision D6).
 */
export class UpdateApplicationDto {
  @ValidateIf((_application, value) => value !== undefined)
  @IsUUID()
  companyId?: string;

  @Transform(trim)
  @ValidateIf((_application, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  position?: string;

  @ValidateIf((_application, value) => value !== undefined)
  @IsEnum(ContractType)
  contractType?: ContractType;

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

  @ValidateIf((_application, value) => value !== undefined)
  @IsCalendarDate()
  @IsNotFutureDate()
  appliedAt?: string;

  /** The salary is replaced as a whole: send both fields, or `null` to remove it. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SalaryDto)
  salary?: SalaryDto | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ValidateIf((_application, value) => value !== undefined)
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsCalendarDate()
  nextFollowUpAt?: string | null;
}
