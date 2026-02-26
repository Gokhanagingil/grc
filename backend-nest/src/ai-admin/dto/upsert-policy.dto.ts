import { IsBoolean, IsOptional, IsString, IsObject } from 'class-validator';

export class UpsertPolicyDto {
  @IsBoolean()
  isAiEnabled: boolean;

  @IsOptional()
  @IsString()
  defaultProviderConfigId?: string | null;

  @IsOptional()
  @IsBoolean()
  humanApprovalRequiredDefault?: boolean;

  @IsOptional()
  @IsObject()
  allowedFeatures?: Record<string, boolean>;
}
