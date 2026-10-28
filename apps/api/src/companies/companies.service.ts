import { ConflictException, Injectable } from '@nestjs/common';
import { orNotFound } from '../common/errors/or-not-found';
import { hasPrismaErrorCode, PrismaErrorCode } from '../common/errors/prisma-errors';
import { buildPaginated, Paginated } from '../common/pagination/paginated-response';
import { toSkipTake } from '../common/pagination/to-skip-take';
import type { Company, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const COMPANY = 'Company';

/**
 * Companies belong to one user. Every method takes the owner's id first, and every
 * query is filtered by it: a company of someone else is indistinguishable from one
 * that does not exist (TECHNICAL_SPEC.md, sections 15 and 28).
 */
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, dto: CreateCompanyDto): Promise<Company> {
    return this.rejectDuplicateName(
      this.prisma.company.create({
        data: { userId, name: dto.name, website: dto.website, location: dto.location },
      }),
    );
  }

  async findAll(userId: string, query: ListCompaniesQueryDto): Promise<Paginated<Company>> {
    const where: Prisma.CompanyWhereInput = { userId };
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    // The page and the total are read in one transaction, so they describe the same data.
    const [companies, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.company.count({ where }),
    ]);

    return buildPaginated(companies, total, query.page, query.limit);
  }

  findOne(userId: string, id: string): Promise<Company> {
    return orNotFound(this.prisma.company.findFirstOrThrow({ where: { id, userId } }), COMPANY);
  }

  update(userId: string, id: string, dto: UpdateCompanyDto): Promise<Company> {
    return this.rejectDuplicateName(
      orNotFound(
        this.prisma.company.update({
          where: { id, userId },
          data: { name: dto.name, website: dto.website, location: dto.location },
        }),
        COMPANY,
      ),
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    try {
      await orNotFound(this.prisma.company.delete({ where: { id, userId } }), COMPANY);
    } catch (error) {
      // The foreign key protects a company that applications still use (RESTRICT).
      if (hasPrismaErrorCode(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw await this.companyInUseError(userId, id);
      }
      throw error;
    }
  }

  /** The database guarantees one name per user, ignoring case: a violation is a 409. */
  private async rejectDuplicateName<T>(operation: Promise<T>): Promise<T> {
    try {
      return await operation;
    } catch (error) {
      if (hasPrismaErrorCode(error, PrismaErrorCode.UniqueViolation)) {
        throw new ConflictException('A company with this name already exists');
      }
      throw error;
    }
  }
  /** Builds the 409 of a company that applications still use, telling how many. */
  private async companyInUseError(userId: string, companyId: string): Promise<ConflictException> {
    const applications = await this.prisma.application.count({ where: { companyId, userId } });

    // The applications may have been deleted since the database refused: keep a generic message.
    if (applications === 0) {
      return new ConflictException('This company is linked to applications and cannot be deleted');
    }

    const noun = applications === 1 ? 'application' : 'applications';
    return new ConflictException(
      `This company is linked to ${applications} ${noun} and cannot be deleted`,
    );
  }
}
