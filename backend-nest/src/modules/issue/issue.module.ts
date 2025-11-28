import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssueEntity } from './issue.entity';
import { IssueService } from './issue.service';
import { IssueController } from './issue.controller';

@Module({
  imports: [TypeOrmModule.forFeature([IssueEntity])],
  controllers: [IssueController],
  providers: [IssueService],
})
export class IssueModule {}
