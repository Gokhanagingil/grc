import { Controller, Get } from '@nestjs/common';

@Controller({ path: 'health', version: '2' })
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'backend-nest',
      time: new Date().toISOString(),
    };
  }
}

