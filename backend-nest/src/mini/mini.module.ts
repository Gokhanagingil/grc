import { Module } from '@nestjs/common';
import { MiniHealthController } from './mini-health.controller';

@Module({
  imports: [],
  controllers: [MiniHealthController],
  providers: [],
})
export class MiniModule {}
