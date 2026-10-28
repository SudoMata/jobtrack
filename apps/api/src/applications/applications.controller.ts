import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { Paginated } from '../common/pagination/paginated-response';
import { toApplicationResponse } from './application-response.mapper';
import { ApplicationsService } from './applications.service';
import { ApplicationResponseDto } from './dto/application-response.dto';
import { ChangeApplicationStatusDto } from './dto/change-application-status.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ListApplicationsQueryDto } from './dto/list-applications-query.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';

/**
 * Applications of the authenticated user. The owner always comes from the verified
 * token (through the AuthGuard), never from the request.
 */
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return toApplicationResponse(await this.applicationsService.create(user.id, dto));
  }

  @Get()
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListApplicationsQueryDto,
  ): Promise<Paginated<ApplicationResponseDto>> {
    const { data, meta } = await this.applicationsService.findAll(user.id, query);
    return { data: data.map(toApplicationResponse), meta };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApplicationResponseDto> {
    return toApplicationResponse(await this.applicationsService.findOne(user.id, id));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return toApplicationResponse(await this.applicationsService.update(user.id, id, dto));
  }

  /** The only way to change a status: every change is recorded in the status history. */
  @Patch(':id/status')
  async changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeApplicationStatusDto,
  ): Promise<ApplicationResponseDto> {
    return toApplicationResponse(await this.applicationsService.changeStatus(user.id, id, dto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.applicationsService.remove(user.id, id);
  }
}
