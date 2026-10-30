import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination-query.dto';
import { trim } from '../../common/validation/trim.transform';

/** Query string of GET /api/admin/users: pagination plus an optional search. */
export class ListAdminUsersQueryDto extends PaginationQueryDto {
  /** Case-insensitive partial match on the email or on the display name. */
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
