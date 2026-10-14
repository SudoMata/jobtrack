/** A company as the API returns it. The owner is never part of it. */
export class CompanyResponseDto {
  id!: string;
  name!: string;
  website!: string | null;
  location!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}
