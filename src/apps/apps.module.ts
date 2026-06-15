import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AppsController } from './apps.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AppsController],
})
export class AppsModule {}
