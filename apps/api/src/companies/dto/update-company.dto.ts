import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { trim, trimToNull } from '../../common/validation/trim.transform';

/**
 * Body of PATCH /api/companies/:id.
 * A field that is not sent is left unchanged. For `website` and `location`,
 * `null` (or a blank text) clears the value.
 */
export class UpdateCompanyDto {
  // The name can be left out, but it can never be cleared: `null` is rejected.
  @Transform(trim)
  @ValidateIf((_company, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

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