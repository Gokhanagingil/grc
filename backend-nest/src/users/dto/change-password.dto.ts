import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Change Password DTO
 *
 * Validates payload for changing a user's password.
 * Users can only change their own password.
 */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword: string;

  @IsString()
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(6, { message: 'New password must be at least 6 characters' })
  newPassword: string;
}
