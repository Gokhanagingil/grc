import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class MiniHealthController {
  @Get()
  get() {
    return {
      status: 'OK',
      message: 'Mini boot is running',
      version: 'mini',
      database: 'skipped',
      timestamp: new Date().toISOString(),
    };
  }
}