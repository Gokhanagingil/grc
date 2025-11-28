import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovPolicy } from './gov.entity';
import { GovService } from './gov.service';
import { GovController } from './gov.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GovPolicy])],
  providers: [GovService],
  controllers: [GovController],
})
export class GovModule {}
