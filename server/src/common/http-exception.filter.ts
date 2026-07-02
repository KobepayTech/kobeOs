import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Map an HTTP status code to the canonical NestJS `error` string
 * (matches the default framework filter). Used only as a last resort
 * when the underlying exception didn't provide its own error name.
 * Previously this fell back to `exception.name.replace(/Exception$/, '')`
 * which for a raw `new HttpException('...', 400)` produced the useless
 * string 'Http' (because HttpException's name is literally
 * 'HttpException').
 */
const ERROR_BY_STATUS: Record<number, string> = {
  400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required',
  403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  406: 'Not Acceptable', 408: 'Request Timeout', 409: 'Conflict',
  410: 'Gone', 411: 'Length Required', 412: 'Precondition Failed',
  413: 'Payload Too Large', 415: 'Unsupported Media Type',
  418: "I'm a Teapot", 422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error', 501: 'Not Implemented',
  502: 'Bad Gateway', 503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

/**
 * Only catches HttpException subclasses; unknown exceptions fall
 * through to Nest's default so subtype filters (e.g. ThrottlerException)
 * can still attach their own headers (Retry-After, WWW-Authenticate,
 * Location) before responding. Previously `@Catch()` with no args
 * ran globally and dropped every subtype-attached header.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception.getStatus();
    const raw = exception.getResponse();

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception.stack);
    }

    // NestJS HttpException.getResponse() returns either a string (when the
    // exception was thrown with a string arg) or an object shaped like
    // { statusCode, message, error }. Flatten both into a top-level
    // { message, error } so the frontend parser can surface a real reason
    // rather than "HTTP 401" / "HTTP 403".
    let message: string | string[] = '';
    let errorName = '';
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
      error: errorName || ERROR_BY_STATUS[status] || 'Error',
    });
  }
}
