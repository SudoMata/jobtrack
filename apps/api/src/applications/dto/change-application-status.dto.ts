import { IsEnum } from 'class-validator';
import { ApplicationStatus } from '../../generated/prisma/enums';

/** Body of PATCH /api/applications/:id/status, the only way to change a status. */
export class ChangeApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;
}
