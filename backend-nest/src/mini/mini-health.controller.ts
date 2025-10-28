import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class MiniHealthController {
  @Get()
  getHealth() {
    return {
      status: 'OK',
      message: 'Mini boot is running',
      version: 'mini',
      timestamp: new Date().toISOString(),
    };
  }
}
