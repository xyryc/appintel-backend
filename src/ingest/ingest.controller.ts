import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import z, { ZodError } from 'zod';

const ingestSchema = z.object({
  apiKey: z.string(),
  eventName: z.string(),
  data: z.record(z.string(), z.any()),
});

@Controller('ingest')
export class IngestController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('event')
  async ingest(@Body() raw: unknown) {
    const result = ingestSchema.safeParse(raw);

    if (!result.success) {
      const err: ZodError = result.error;
      const messages = err.issues.map((i) => i.message);
      throw new HttpException({ errors: messages }, HttpStatus.BAD_REQUEST);
    }

    const { apiKey, eventName, data } = result.data;

    // find app by API key
    const app = await this.prisma.app.findUnique({ where: { apiKey } });
    if (!app) {
      throw new HttpException('Invalid API key', HttpStatus.UNAUTHORIZED);
    }

    // create event record
    await this.prisma.event.create({
      data: {
        appId: app.id,
        name: eventName,
        data,
      },
    });

    return { status: 'ok' };
  }
}
