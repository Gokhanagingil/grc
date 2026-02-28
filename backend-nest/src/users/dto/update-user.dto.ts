import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { UserRole } from '../user.entity';

/** Supported locale codes for i18n Phase 1 */
export const SUPPORTED_LOCALES = ['en-US', 'tr-TR'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Update User DTO
 *
 * Validates payload for updating a user.
 * Users can update their own profile (limited fields).
 * Admins can update any user (all fields).
 */
export class UpdateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsEnum(UserRole, { message: 'Role must be admin, manager, or user' })
  @IsOptional()
  role?: UserRole;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsIn(SUPPORTED_LOCALES, {
    message: `Locale must be one of: ${SUPPORTED_LOCALES.join(', ')}`,
  })
  @IsOptional()
  locale?: SupportedLocale;
}
