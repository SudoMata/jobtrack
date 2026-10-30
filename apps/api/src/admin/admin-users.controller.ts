import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Paginated } from '../common/pagination/paginated-response';
import { Role } from '../generated/prisma/enums';
import { toAdminUserResponse } from './admin-user-response.mapper';
import { AdminUsersService } from './admin-users.service';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';

/** User management for administrators. Every route of this controller is reserved to them. */
@Controller('admin/users')
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  async findAll(@Query() query: ListAdminUsersQueryDto): Promise<Paginated<AdminUserResponseDto>> {
    const { data, meta } = await this.adminUsersService.findAll(query);
    return { data: data.map(toAdminUserResponse), meta };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserResponseDto> {
    return toAdminUserResponse(await this.adminUsersService.findOne(id));
  }
}
