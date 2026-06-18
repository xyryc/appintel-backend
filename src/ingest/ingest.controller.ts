import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import z, { ZodError } from 'zod';

interface EventsQuery {
  apiKey?: string;
  appName?: string;
  eventName?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  pageSize?: string;
}

interface DailyStatsQuery {
  apiKey?: string;
  appName?: string;
  startDate?: string;
  endDate?: string;
}

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

  @Get('events')
  async getEvents(@Query() q: EventsQuery) {
    const {
      apiKey,
      appName,
      eventName,
      startDate,
      endDate,
      page = '1',
      pageSize = '20',
    } = q;
    const pageNum = parseInt(page, 10);
    const pageSizeNum = parseInt(pageSize, 10);

    const where: Prisma.EventWhereInput = {};
    if (apiKey) {
      const app = await this.prisma.app.findUnique({ where: { apiKey } });
      if (!app) throw new HttpException('App not found', HttpStatus.NOT_FOUND);
      where.appId = app.id;
    }

    if (appName) {
      const app = await this.prisma.app.findFirst({
        where: { name: { contains: appName } },
      });
      if (!app) throw new HttpException('App not found', HttpStatus.NOT_FOUND);
      where.appId = app.id;
    }

    if (eventName) {
      where.name = eventName;
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    const total = await this.prisma.event.count({ where });
    const events = await this.prisma.event.findMany({
      where,
      skip: (pageNum - 1) * pageSizeNum,
      take: pageSizeNum,
      orderBy: { timestamp: 'desc' },
    });

    return {
      data: events,
      pagination: {
        total,
        page: pageSizeNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    };
  }

  @Get('stats/daily')
  async dailyStats(@Query() q: DailyStatsQuery) {
    const { apiKey, appName, startDate, endDate } = q;

    const where: Prisma.DailyStatsWhereInput = {};

    if (apiKey) {
      const app = await this.prisma.app.findUnique({ where: { apiKey } });
      if (!app) throw new HttpException('App not found', HttpStatus.NOT_FOUND);
      where.appId = app.id;
    }

    if (appName) {
      const app = await this.prisma.app.findFirst({
        where: { name: { contains: appName } },
      });
      if (!app) throw new HttpException('App not found', HttpStatus.NOT_FOUND);
      where.appId = app.id;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    const stats = await this.prisma.dailyStats.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return { stats };
  }
}
