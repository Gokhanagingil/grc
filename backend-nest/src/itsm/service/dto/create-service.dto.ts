import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';
import { ServiceCriticality, ServiceStatus } from '../service.entity';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty({ message: 'Service name is required' })
  @MaxLength(255)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ServiceCriticality)
  @IsOptional()
  criticality?: ServiceCriticality;

  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  @IsUUID('4')
  @IsOptional()
  ownerUserId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
