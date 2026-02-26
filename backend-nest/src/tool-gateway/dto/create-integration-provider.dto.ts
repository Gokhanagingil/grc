import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { IntegrationAuthType, IntegrationProviderKey } from '../entities';

export class CreateIntegrationProviderDto {
  @IsEnum(IntegrationProviderKey)
  providerKey: IntegrationProviderKey;

  @IsString()
  @MaxLength(255)
  displayName: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
      protocols: ['https'],
    },
    { message: 'baseUrl must be a valid HTTPS URL' },
  )
  baseUrl: string;

  @IsEnum(IntegrationAuthType)
  authType: IntegrationAuthType;

  /** Plaintext username — will be encrypted before storage */
  @IsOptional()
  @IsString()
  username?: string;

  /** Plaintext password — will be encrypted before storage */
  @IsOptional()
  @IsString()
  password?: string;

  /** Plaintext API token — will be encrypted before storage */
  @IsOptional()
  @IsString()
  token?: string;

  /** Plaintext custom headers JSON — will be encrypted before storage */
  @IsOptional()
  @IsString()
  customHeaders?: string;
}
