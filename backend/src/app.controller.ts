import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      app: 'copa-leyendas-api',
      now: new Date().toISOString(),
    };
  }
}
