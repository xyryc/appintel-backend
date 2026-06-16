import { PrismaModule } from 'src/prisma/prisma.module';
import { IngestController } from './ingest.controller';
import { Module } from '@nestjs/common';

@Module({
  imports: [PrismaModule],
  controllers: [IngestController],
})
export class IngestModule {}
