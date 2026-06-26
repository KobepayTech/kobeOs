import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : (exception as Error)?.message ?? 'Internal server error';

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, (exception as Error)?.stack);
    }

    // NestJS HttpException.getResponse() returns either a string (when the
    // exception was thrown with a string arg) or an object shaped like
    // { statusCode, message, error }. Flatten both into a single top-level
    // shape with `message` + `error` strings so the frontend's error
    // parser (api.ts) can surface a human-readable reason instead of
    // falling back to "HTTP 401" / "HTTP 403".
    let message: string | string[] = '';
    let errorName: string = '';
    if (typeof raw === 'string') {
      message = raw;
    } else if (raw && typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      message = (typeof obj.message === 'string' || Array.isArray(obj.message))
        ? (obj.message as string | string[])
        : '';
      errorName = typeof obj.error === 'string' ? obj.error : '';
    }

    response.status(status).json({
      statusCode: status,
      path: request.url,
      timestamp: new Date().toISOString(),
      message,
      error: errorName || (exception instanceof HttpException ? exception.name.replace(/Exception$/, '') : 'Error'),
    });
  }
}
