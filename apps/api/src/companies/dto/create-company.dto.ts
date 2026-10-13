import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { trim, trimToNull } from '../../common/validation/trim.transform';

/** Body of POST /api/companies. */
export class CreateCompanyDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @Transform(trimToNull)
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  website?: string | null;

  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(150)
  location?: string | null;
}
