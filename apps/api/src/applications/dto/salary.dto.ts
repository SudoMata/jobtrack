import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import { trim, trimUppercase } from '../../common/validation/trim.transform';

/** A salary. The amount and its currency always travel together (decision D47). */
export class SalaryDto {
  /**
   * Decimal text, never a number: money must not go through a floating point.
   * At most 10 digits before the point and 2 after, never negative.
   */
  @Transform(trim)
  @Matches(/^\d{1,10}(\.\d{1,2})?$/, {
    message: 'amount must be a decimal text with at most 10 digits and 2 decimals, like "3500.00"',
  })
  amount!: string;

  @Transform(trimUppercase)
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter code such as USD' })
  currency!: string;
}
