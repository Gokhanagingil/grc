import { Module } from '@nestjs/common';
import { MiniHealthController } from './mini-health.controller';

@Module({ controllers: [MiniHealthController] })
export class MiniModule {}