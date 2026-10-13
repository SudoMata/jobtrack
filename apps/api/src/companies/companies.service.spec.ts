import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import type { Company } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

const USER_ID = '3f2b8c1e-5d4a-4c6b-9a7e-1b2c3d4e5f60';
const COMPANY_ID = '9a1d7e52-2c3b-4f08-8e6a-0d5b7c4a1e93';

function buildCompany(): Company {
  return {
    id: COMPANY_ID,
    userId: USER_ID,
    name: 'Acme',
    website: null,
    location: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('failure', { code, clientVersion: 'test' });
}

function createDto(fields: Partial<CreateCompanyDto>): CreateCompanyDto {
  return Object.assign(new CreateCompanyDto(), fields);
}

function updateDto(fields: Partial<UpdateCompanyDto>): UpdateCompanyDto {
  return Object.assign(new UpdateCompanyDto(), fields);
}

function listQuery(fields: Partial<ListCompaniesQueryDto> = {}): ListCompaniesQueryDto {
  return Object.assign(new ListCompaniesQueryDto(), fields);
}

describe('CompaniesService', () => {
  const create = jest.fn();
  const findMany = jest.fn();
  const count = jest.fn();
  const findFirstOrThrow = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const transaction = jest.fn();
  let service: CompaniesService;

  beforeEach(() => {
    jest.resetAllMocks();
    transaction.mockImplementation((operations: unknown[]) => Promise.all(operations));
    service = new CompaniesService({
      company: { create, findMany, count, findFirstOrThrow, update, delete: remove },
      $transaction: transaction,
    } as unknown as PrismaService);
  });

  describe('create', () => {
    it('creates the company for the given user', async () => {
      const company = buildCompany();
      create.mockResolvedValue(company);

      const dto = createDto({ name: 'Acme', website: 'https://acme.com', location: 'Kinshasa' });
      await expect(service.create(USER_ID, dto)).resolves.toBe(company);

      expect(create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          name: 'Acme',
          website: 'https://acme.com',
          location: 'Kinshasa',
        },
      });
    });

    it('answers 409 when the user already has a company with this name', async () => {
      create.mockRejectedValue(prismaError('P2002'));

      await expect(service.create(USER_ID, createDto({ name: 'Acme' }))).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('lets any other error through', async () => {
      create.mockRejectedValue(new Error('connection lost'));

      await expect(service.create(USER_ID, createDto({ name: 'Acme' }))).rejects.toThrow(
        'connection lost',
      );
    });
  });

  describe('findAll', () => {
    it('only lists the companies of the user, ordered by name, one page at a time', async () => {
      const company = buildCompany();
      findMany.mockResolvedValue([company]);
      count.mockResolvedValue(1);

      const result = await service.findAll(USER_ID, listQuery());

      expect(findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: 0,
        take: 20,
      });
      expect(count).toHaveBeenCalledWith({ where: { userId: USER_ID } });
      expect(result).toEqual({
        data: [company],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
    });

    it('searches the name without caring about the case, still within the user companies', async () => {
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);

      await service.findAll(USER_ID, listQuery({ search: 'acme' }));

      const where = { userId: USER_ID, name: { contains: 'acme', mode: 'insensitive' } };
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
      expect(count).toHaveBeenCalledWith({ where });
    });

    it('ignores a blank search', async () => {
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(0);

      await service.findAll(USER_ID, listQuery({ search: '' }));

      expect(count).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    });

    it('skips the previous pages', async () => {
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(100);

      await service.findAll(USER_ID, listQuery({ page: 3, limit: 10 }));

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
    });

    it('answers an empty page, not an error, beyond the last page', async () => {
      findMany.mockResolvedValue([]);
      count.mockResolvedValue(5);

      await expect(service.findAll(USER_ID, listQuery({ page: 9 }))).resolves.toEqual({
        data: [],
        meta: { page: 9, limit: 20, total: 5, totalPages: 1 },
      });
    });
  });

  describe('findOne', () => {
    it('looks the company up by id and by owner together', async () => {
      const company = buildCompany();
      findFirstOrThrow.mockResolvedValue(company);

      await expect(service.findOne(USER_ID, COMPANY_ID)).resolves.toBe(company);

      expect(findFirstOrThrow).toHaveBeenCalledWith({ where: { id: COMPANY_ID, userId: USER_ID } });
    });

    it('answers 404 for a company that does not exist or belongs to someone else', async () => {
      findFirstOrThrow.mockRejectedValue(prismaError('P2025'));

      await expect(service.findOne(USER_ID, COMPANY_ID)).rejects.toThrow(
        new NotFoundException('Company not found'),
      );
    });
  });

  describe('update', () => {
    it('updates the company by id and by owner together', async () => {
      const company = buildCompany();
      update.mockResolvedValue(company);

      await expect(service.update(USER_ID, COMPANY_ID, updateDto({ name: 'New name' }))).resolves.toBe(
        company,
      );

      expect(update).toHaveBeenCalledWith({
        where: { id: COMPANY_ID, userId: USER_ID },
        data: { name: 'New name', website: undefined, location: undefined },
      });
    });

    it('clears the website when null is sent', async () => {
      update.mockResolvedValue(buildCompany());

      await service.update(USER_ID, COMPANY_ID, updateDto({ website: null }));

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ website: null }) }),
      );
    });

    it('answers 404 for a company that does not exist or belongs to someone else', async () => {
      update.mockRejectedValue(prismaError('P2025'));

      await expect(service.update(USER_ID, COMPANY_ID, updateDto({ name: 'X' }))).rejects.toThrow(
        new NotFoundException('Company not found'),
      );
    });

    it('answers 409 when the new name is already used by another company of the user', async () => {
      update.mockRejectedValue(prismaError('P2002'));

      await expect(
        service.update(USER_ID, COMPANY_ID, updateDto({ name: 'Taken' })),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes the company by id and by owner together', async () => {
      remove.mockResolvedValue(buildCompany());

      await expect(service.remove(USER_ID, COMPANY_ID)).resolves.toBeUndefined();

      expect(remove).toHaveBeenCalledWith({ where: { id: COMPANY_ID, userId: USER_ID } });
    });

    it('answers 404 for a company that does not exist or belongs to someone else', async () => {
      remove.mockRejectedValue(prismaError('P2025'));

      await expect(service.remove(USER_ID, COMPANY_ID)).rejects.toThrow(
        new NotFoundException('Company not found'),
      );
    });

    it('answers 409 when applications still use the company', async () => {
      remove.mockRejectedValue(prismaError('P2003'));

      await expect(service.remove(USER_ID, COMPANY_ID)).rejects.toBeInstanceOf(ConflictException);
    });

    it('lets any other error through', async () => {
      remove.mockRejectedValue(new Error('connection lost'));

      await expect(service.remove(USER_ID, COMPANY_ID)).rejects.toThrow('connection lost');
    });
  });
});