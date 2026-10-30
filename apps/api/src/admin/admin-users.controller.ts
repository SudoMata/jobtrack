import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { Paginated } from '../common/pagination/paginated-response';
import { Role } from '../generated/prisma/enums';
import { ADMIN_WRITE_THROTTLE } from './admin-write-throttle';
import { toAdminUserResponse } from './admin-user-response.mapper';
import { AdminUserChangesService } from './admin-user-changes.service';
import { AdminUsersService } from './admin-users.service';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { ChangeUserStatusDto } from './dto/change-user-status.dto';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';

/** User management for administrators. Every route of this controller is reserved to them. */
@Controller('admin/users')
@Roles(Role.ADMIN)
export class AdminUsersController {
  constructor(
    private readonly adminUsersService: AdminUsersService,
    private readonly adminUserChangesService: AdminUserChangesService,
  ) {}

  @Get()
  async findAll(@Query() query: ListAdminUsersQueryDto): Promise<Paginated<AdminUserResponseDto>> {
    const { data, meta } = await this.adminUsersService.findAll(query);
    return { data: data.map(toAdminUserResponse), meta };
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserResponseDto> {
    return toAdminUserResponse(await this.adminUsersService.findOne(id));
  }

  @Patch(':id/role')
  @Throttle(ADMIN_WRITE_THROTTLE)
  async changeRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserRoleDto,
  ): Promise<AdminUserResponseDto> {
    return toAdminUserResponse(
      await this.adminUserChangesService.changeRole(actor.id, id, dto.role),
    );
  }

  @Patch(':id/status')
  @Throttle(ADMIN_WRITE_THROTTLE)
  async changeStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeUserStatusDto,
  ): Promise<AdminUserResponseDto> {
    return toAdminUserResponse(
      await this.adminUserChangesService.changeStatus(actor.id, id, dto.status),
    );
  }
}
