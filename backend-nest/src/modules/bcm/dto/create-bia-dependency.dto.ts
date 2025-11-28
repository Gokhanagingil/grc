import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsEnum } from 'class-validator';
import { DependencyType } from '../../../entities/app/bia-process-dependency.entity';

export class CreateBIADependencyDto {
  @ApiProperty({ example: 'uuid-of-process', description: 'BIA Process ID' })
  @IsUUID()
  process_id!: string;

  @ApiProperty({
    example: 'uuid-of-entity',
    description: 'Entity ID (Application, Database, Service, Vendor)',
  })
  @IsUUID()
  entity_id!: string;

  @ApiProperty({
    example: 'app',
    enum: DependencyType,
    description: 'Dependency type',
  })
  @IsEnum(DependencyType)
  dependency_type!: DependencyType;
}
