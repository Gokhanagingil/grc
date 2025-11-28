import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { AuditEvidenceType } from '../../../entities/app/audit-evidence.entity';

export class CreateAuditEvidenceDto {
  @ApiPropertyOptional({ example: 'uuid-of-test', description: 'Test ID (if related to test)' })
  @IsOptional()
  @IsUUID()
  test_id?: string;

  @ApiProperty({ example: 'note', enum: AuditEvidenceType, default: 'note' })
  @IsEnum(AuditEvidenceType)
  type!: AuditEvidenceType;

  @ApiPropertyOptional({
    example: 'test',
    description: 'Related entity type (test, finding, corrective_action)',
  })
  @IsOptional()
  @IsString()
  related_entity_type?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-entity',
    description: 'Related entity ID',
  })
  @IsOptional()
  @IsUUID()
  related_entity_id?: string;

  @ApiPropertyOptional({
    example: 'evidence.pdf',
    description: 'File name (for document type)',
  })
  @IsOptional()
  @IsString()
  file_name?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/evidence.pdf',
    description: 'File URL or link',
  })
  @IsOptional()
  @IsString()
  file_url?: string;

  @ApiPropertyOptional({
    example: 'Evidence text or URI',
    description: 'URI for link/document, text for note (alias)',
  })
  @IsOptional()
  @IsString()
  uri_or_text?: string;

  @ApiPropertyOptional({
    example: 'Additional notes',
    description: 'Evidence notes',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({
    example: '2025-01-15T10:00:00Z',
    description: 'Collection timestamp (ISO)',
  })
  @IsDateString()
  collected_at!: string;

  @ApiProperty({
    example: 'uuid-of-user',
    description: 'Collector user ID',
    required: false,
  })
  @IsUUID()
  collected_by?: string;
}
