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
        page: pageNum,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    };
  }

  @Get('stats/daily')
  async dailyStats(@Query() q: DailyStatsQuery) {
    const { apiKey, appName, startDate, endDate } = q;

    // 1) First, figure out which app we are filtering by.
    //    We only need the app id because Event rows store appId.
    let appId: number | undefined;

    // If user passed apiKey, find the matching App row.
    if (apiKey) {
      const app = await this.prisma.app.findUnique({ where: { apiKey } });
      if (!app) throw new HttpException('App not found', HttpStatus.NOT_FOUND);
      appId = app.id;
    }

    // If user passed appName, find a matching App row by name.
    if (appName) {
      const app = await this.prisma.app.findFirst({
        where: { name: { contains: appName } },
      });
      if (!app) throw new HttpException('App not found', HttpStatus.NOT_FOUND);
      appId = app.id;
    }

    // 2) Build a filter for the Event table.
    //    We are NOT reading DailyStats here.
    //    We are calculating stats from Event rows.
    const where: Prisma.EventWhereInput = {};

    // If we found an app, only count that app's events.
    if (appId) {
      where.appId = appId;
    }

    // If the user passed dates, filter events by timestamp.
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        where.timestamp.lte = new Date(endDate);
      }
    }

    // 3) Fetch only the fields we need from Event.
    //    We don't need the full Event object.
    const events = await this.prisma.event.findMany({
      where,
      select: {
        timestamp: true,
        data: true,
      },
    });

    // 4) Group events by day.
    //    Example result shape:
    //    {
    //      "2026-06-19": {
    //        date: "2026-06-19",
    //        eventCount: 3,
    //        sessionCount: 2
    //      }
    //    }
    const grouped: Record<
      string,
      { date: string; eventCount: number; sessionCount: number }
    > = {};

    for (const event of events) {
      // Convert event timestamp into YYYY-MM-DD.
      // Example: 2026-06-19T10:12:20.829Z -> 2026-06-19
      const day = event.timestamp.toISOString().split('T')[0];

      // Create the bucket if this day doesn't exist yet.
      if (!grouped[day]) {
        grouped[day] = {
          date: day,
          eventCount: 0,
          sessionCount: 0,
        };
      }

      // Every fetched row is an event, so increment event count.
      grouped[day].eventCount += 1;

      // 5) Count a "session" if the event data looks like a session event.
      //    We don't have a separate Session table populated yet.
      //    So we infer sessionCount from event payload fields.
      const eventData = event.data as Record<string, unknown>;

      if (eventData && typeof eventData === 'object') {
        // If payload has session or duration, treat it as session-related.
        if (
          eventData.session !== undefined ||
          eventData.duration !== undefined
        ) {
          grouped[day].sessionCount += 1;
        }
      }
    }

    // 6) Convert grouped object to array and sort newest first.
    const stats = Object.values(grouped).sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    // 7) Return aggregated daily stats.
    return { stats };
  }
}
