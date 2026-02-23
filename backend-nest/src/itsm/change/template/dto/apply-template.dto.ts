import { IsUUID, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class ApplyTemplateDto {
  @IsUUID('4')
  @IsNotEmpty()
  templateId: string;

  @IsBoolean()
  @IsOptional()
  force?: boolean;
}
