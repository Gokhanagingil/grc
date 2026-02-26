import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { AiProviderType } from '../entities';

export class UpdateProviderDto {
  @IsOptional()
  @IsEnum(AiProviderType)
  providerType?: AiProviderType;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
      protocols: ['http', 'https'],
    },
    { message: 'baseUrl must be a valid HTTP or HTTPS URL' },
  )
  baseUrl?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsNumber()
  @Min(1000)
  @Max(300000)
  requestTimeoutMs?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  /** Plaintext API key — will be encrypted before storage */
  @IsOptional()
  @IsString()
  apiKey?: string;

  /** Plaintext custom headers JSON — will be encrypted before storage */
  @IsOptional()
  @IsString()
  customHeaders?: string;
}
