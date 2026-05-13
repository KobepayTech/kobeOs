import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const user = (req as any).user?.email || 'anonymous';
      this.logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms - ${user}`,
      );
    });
    next();
  }
}
