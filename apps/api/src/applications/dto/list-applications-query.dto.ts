import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { trim } from '../../common/validation/trim.transform';
import { ApplicationStatus, ContractType, Priority, WorkMode } from '../../generated/prisma/enums';
import { APPLICATION_SORT_VALUES, DEFAULT_APPLICATION_SORT } from '../application-sort';
import type { ApplicationSort } from '../application-sort';

/** Query string of GET /api/applications: search, filters, sort and pagination. */
export class ListApplicationsQueryDto extends PaginationQueryDto {
  /** Case-insensitive partial match on the company name and on the position. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  /** Case-insensitive partial match. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string;

  @IsOptional()
  @IsEnum(WorkMode)
  workMode?: WorkMode;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsIn(APPLICATION_SORT_VALUES)
  sort: ApplicationSort = DEFAULT_APPLICATION_SORT;
}
