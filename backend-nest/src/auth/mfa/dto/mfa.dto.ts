import { IsString, IsNotEmpty, Length, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO for MFA setup initiation
 */
export class MfaSetupDto {
  @IsString()
  @IsNotEmpty()
  secret: string;
}

/**
 * DTO for MFA verification
 */
export class MfaVerifyDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 8)
  code: string;
}

/**
 * DTO for MFA challenge during login
 */
export class MfaChallengeDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 8)
  code: string;

  @IsString()
  @IsOptional()
  mfaToken?: string;
}

/**
 * DTO for admin MFA enforcement
 */
export class MfaEnforceDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

/**
 * DTO for admin MFA reset
 */
export class MfaResetDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}

/**
 * DTO for tenant security settings update
 */
export class UpdateSecuritySettingsDto {
  @IsBoolean()
  @IsOptional()
  mfaRequiredForAdmins?: boolean;

  @IsBoolean()
  @IsOptional()
  mfaRequiredForAll?: boolean;

  @IsOptional()
  passwordMinLength?: number;

  @IsBoolean()
  @IsOptional()
  passwordRequireUppercase?: boolean;

  @IsBoolean()
  @IsOptional()
  passwordRequireLowercase?: boolean;

  @IsBoolean()
  @IsOptional()
  passwordRequireNumber?: boolean;

  @IsBoolean()
  @IsOptional()
  passwordRequireSpecial?: boolean;

  @IsOptional()
  sessionTimeoutMinutes?: number;
}

/**
 * Response DTO for MFA setup
 */
export class MfaSetupResponseDto {
  secret: string;
  qrCodeUrl: string;
  manualEntryKey: string;
}

/**
 * Response DTO for MFA status
 */
export class MfaStatusResponseDto {
  enabled: boolean;
  enforced: boolean;
  verifiedAt: Date | null;
  lastUsedAt: Date | null;
}

/**
 * Response DTO for MFA verification with recovery codes
 */
export class MfaVerifyResponseDto {
  enabled: boolean;
  recoveryCodes?: string[];
}
