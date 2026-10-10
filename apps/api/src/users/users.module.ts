import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MeController } from './me.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule],
  controllers: [MeController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
