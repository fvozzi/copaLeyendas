import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

type ActivityRequest = Request & { activityRequestId?: string };

@Catch()
export class HttpExceptionLogFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionLogFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<ActivityRequest>();
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const requestId = request.activityRequestId ?? 'sin-id';
    if (statusCode >= 500) {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(`requestId=${requestId} ${request.method} ${request.originalUrl} status=${statusCode} ${error.message}`, error.stack);
    }
    if (statusCode >= 500) {
      response.status(statusCode).json({ statusCode, message: 'Internal server error', requestId });
      return;
    }
    const body = exception instanceof HttpException ? exception.getResponse() : { message: 'Request failed' };
    response.status(statusCode).json(typeof body === 'string' ? { statusCode, message: body } : body);
  }
}
