import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AuthenticatedUser } from '../auth/current-user.decorator';
import { ActivityService } from './activity.service';

type ActivityRequest = Request & { user?: AuthenticatedUser; activityRequestId?: string };

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(private readonly activity: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<ActivityRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const requestId = randomUUID();
    const startedAt = Date.now();
    const path = safeRoute(request);
    request.activityRequestId = requestId;
    response.setHeader('X-Request-Id', requestId);
    if (excluded(request.method, path)) return next.handle();

    const save = (statusCode: number, error?: unknown) => this.activity.record({
      requestId,
      level: statusCode >= 500 ? 'ERROR' : statusCode >= 400 ? 'WARNING' : 'INFO',
      source: request.user || path.includes('/auth/') ? 'ADMIN' : 'PUBLIC',
      method: request.method,
      path,
      message: describeActivity(request.method, path, statusCode),
      statusCode,
      durationMs: Date.now() - startedAt,
      actorUserId: request.user?.sub ?? null,
      actorName: request.user?.name ?? null,
      detail: error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 2000) : null,
    });

    return next.handle().pipe(tap({
      next: () => save(response.statusCode),
      error: (error: unknown) => save(error instanceof HttpException ? error.getStatus() : 500, error),
    }));
  }
}

function safeRoute(request: Request) {
  const configured = typeof request.route?.path === 'string' ? request.route.path : '';
  const route = configured ? `${request.baseUrl ?? ''}${configured}` : request.originalUrl.split('?')[0];
  return route
    .replace(/\/public\/registrations\/access\/[^/]+$/i, '/public/registrations/access/:token')
    .slice(0, 300);
}

function excluded(method: string, path: string) {
  return path.endsWith('/health') || path.endsWith('/activity') || (method === 'GET' && path.endsWith('/backups'));
}

function describeActivity(method: string, path: string, status: number) {
  const failed = status >= 400;
  if (method === 'GET' && path.includes('/public/registrations/access/')) return failed ? 'Falló la consulta de un token de inscripción' : 'Token de inscripción consultado';
  if (method === 'POST' && path.endsWith('/public/registrations')) return failed ? 'Falló el envío de una inscripción' : 'Inscripción enviada';
  if (method === 'POST' && path.includes('/send-whatsapp')) return failed ? 'Falló un envío por WhatsApp' : 'Token enviado por WhatsApp';
  if (method === 'POST') return failed ? 'Falló una creación' : 'Registro creado';
  if (method === 'PATCH' || method === 'PUT') return failed ? 'Falló una modificación' : 'Registro modificado';
  if (method === 'DELETE') return failed ? 'Falló una eliminación' : 'Registro eliminado';
  return failed ? 'Falló una consulta' : 'Consulta realizada';
}
