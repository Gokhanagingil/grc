import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SysGroup } from './entities/group.entity';
import { SysGroupMembership } from './entities/group-membership.entity';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { GuardsModule } from '../common/guards';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([SysGroup, SysGroupMembership, User]),
    GuardsModule,
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
