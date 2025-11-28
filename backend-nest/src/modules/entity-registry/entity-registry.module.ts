import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntityRegistryController } from './entity-registry.controller';
import { EntityTypeService } from './entity-type.service';
import { EntityService } from './entity.service';
import { EntityTypeEntity } from '../../entities/app/entity-type.entity';
import { EntityEntity } from '../../entities/app/entity.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EntityTypeEntity, EntityEntity])],
  controllers: [EntityRegistryController],
  providers: [EntityTypeService, EntityService],
  exports: [EntityTypeService, EntityService],
})
export class EntityRegistryModule {}
