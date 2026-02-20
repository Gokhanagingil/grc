import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

/**
 * DTO for LDAP configuration update
 */
export class UpdateLdapConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  host?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsBoolean()
  @IsOptional()
  useSsl?: boolean;

  @IsString()
  @IsOptional()
  bindDn?: string;

  @IsString()
  @IsOptional()
  bindPassword?: string;

  @IsString()
  @IsOptional()
  baseDn?: string;

  @IsString()
  @IsOptional()
  userSearchFilter?: string;

  @IsString()
  @IsOptional()
  usernameAttribute?: string;

  @IsString()
  @IsOptional()
  emailAttribute?: string;

  @IsString()
  @IsOptional()
  firstNameAttribute?: string;

  @IsString()
  @IsOptional()
  lastNameAttribute?: string;

  @IsString()
  @IsOptional()
  groupSearchBase?: string;

  @IsString()
  @IsOptional()
  groupSearchFilter?: string;

  @IsString()
  @IsOptional()
  defaultRole?: string;

  @IsBoolean()
  @IsOptional()
  allowLocalFallback?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(1000)
  @Max(30000)
  connectionTimeoutMs?: number;
}

/**
 * DTO for LDAP group to role mapping
 */
export class LdapGroupMappingDto {
  @IsString()
  @IsNotEmpty()
  ldapGroupDn: string;

  @IsString()
  @IsNotEmpty()
  platformRole: string;

  @IsString()
  @IsOptional()
  ldapGroupName?: string;

  @IsNumber()
  @IsOptional()
  priority?: number;
}

/**
 * Response DTO for LDAP status
 */
export class LdapStatusResponseDto {
  enabled: boolean;
  configured: boolean;
  host: string | null;
  port: number;
  useSsl: boolean;
  lastConnectionTest: Date | null;
  lastConnectionStatus: string | null;
}

/**
 * Response DTO for LDAP connection test
 */
export class LdapConnectionTestResponseDto {
  success: boolean;
  message: string;
  responseTimeMs: number;
}
