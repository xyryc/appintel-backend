import { MiddlewareConsumer, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AppConfigModule } from './config/app-config.module';
import { AppsModule } from './apps/apps.module';
import { IngestModule } from './ingest/ingest.module';
import { LoggerMiddleware } from './common/logger.middleware';

@Module({
  imports: [AppConfigModule, PrismaModule, AppsModule, IngestModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
