import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { trim } from '../../common/validation/trim.transform';

/** Query string of GET /api/companies: pagination plus an optional name search. */
export class ListCompaniesQueryDto extends PaginationQueryDto {
  /** Case-insensitive partial match on the company name. A blank search is ignored. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}