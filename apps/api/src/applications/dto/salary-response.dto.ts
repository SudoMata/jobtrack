/** A salary as the API returns it: the amount is an exact decimal text, like "3500.00". */
export class SalaryResponseDto {
  amount!: string;
  currency!: string;
}
