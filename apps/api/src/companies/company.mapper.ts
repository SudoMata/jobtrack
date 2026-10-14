import type { Company } from '../generated/prisma/client';
import { CompanyResponseDto } from './dto/company-response.dto';

/** Copies the public fields one by one: a field added to the table later is not exposed by accident. */
export function toCompanyResponse(company: Company): CompanyResponseDto {
  return {
    id: company.id,
    name: company.name,
    website: company.website,
    location: company.location,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}
