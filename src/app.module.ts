import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AppConfigModule } from './config/app-config.module';
import { AppsModule } from './apps/apps.module';

@Module({
  imports: [AppConfigModule, PrismaModule, AppsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
