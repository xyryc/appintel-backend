import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, query, params } = req;
    const body = req.body as Record<string, unknown>;
    const start = Date.now();

    // after response finishes, log details
    res.on('finish', () => {
      const { statusCode } = res;
      const elapsed = Date.now() - start;

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} - ${elapsed}ms\n` +
          `query: ${JSON.stringify(query)}\n` +
          `params: ${JSON.stringify(params)}\n` +
          `body: ${JSON.stringify(body)}`,
      );
    });

    next();
  }
}
