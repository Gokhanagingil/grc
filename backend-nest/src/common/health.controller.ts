import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

const START_TS = Date.now();

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  getHealth() {
    const response: {
      status: string;
      time: string;
      db: 'up' | 'down';
      version: string;
      build: string | null;
      uptimeSecs: number;
    } = {
      status: 'ok',
      time: new Date().toISOString(),
      db: 'down',
      version: '0.1.0',
      build: process.env.BUILD_TAG ?? null,
      uptimeSecs: Math.floor((Date.now() - START_TS) / 1000),
    };
    // Try simple probe without throwing
    return this.dataSource
      .query('SELECT 1')
      .then(() => ({ ...response, db: 'up' as const }))
      .catch(() => response);
  }
}
