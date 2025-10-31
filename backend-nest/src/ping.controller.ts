import { Controller, Get } from '@nestjs/common';

@Controller({ path: 'ping', version: '2' })
export class PingController {
  @Get()
  pong() {
    return { ok: true, ts: new Date().toISOString() };
  }
}

