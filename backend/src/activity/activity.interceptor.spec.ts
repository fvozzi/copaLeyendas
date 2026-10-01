import { firstValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ActivityInterceptor } from './activity.interceptor';

function setup(options?: { method?: string; originalUrl?: string; statusCode?: number }) {
  const activity = { record: vi.fn() };
  const request = {
    method: options?.method ?? 'GET',
    originalUrl: options?.originalUrl ?? '/api/public/registrations/access/COPA-SECRET?from=whatsapp',
    baseUrl: '', route: undefined, user: undefined,
  };
  const response = { statusCode: options?.statusCode ?? 200, setHeader: vi.fn() };
  const context = { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) };
  return { activity, request, response, context, interceptor: new ActivityInterceptor(activity as never) };
}

describe('ActivityInterceptor', () => {
  it('records successful public interactions without exposing registration tokens', async () => {
    const { activity, response, context, interceptor } = setup();
    await firstValueFrom(interceptor.intercept(context as never, { handle: () => of({ ok: true }) }));
    expect(response.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
    expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({
      level: 'INFO', source: 'PUBLIC', statusCode: 200,
      path: '/api/public/registrations/access/:token',
      message: 'Token de inscripción consultado',
    }));
    expect(JSON.stringify(activity.record.mock.calls)).not.toContain('COPA-SECRET');
  });

  it('records unexpected failures with the same request identifier', async () => {
    const { activity, context, interceptor } = setup({ method: 'POST', originalUrl: '/api/public/registrations' });
    await expect(firstValueFrom(interceptor.intercept(context as never, { handle: () => throwError(() => new Error('database failed')) }))).rejects.toThrow('database failed');
    expect(activity.record).toHaveBeenCalledWith(expect.objectContaining({
      level: 'ERROR', statusCode: 500, message: 'Falló el envío de una inscripción', detail: 'Error: database failed',
    }));
  });
});
