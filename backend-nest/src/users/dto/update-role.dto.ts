import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '../user.entity';

/**
 * Update Role DTO
 *
 * Validates payload for updating a user's role.
 * Admin only operation.
 */
export class UpdateRoleDto {
  @IsEnum(UserRole, { message: 'Role must be admin, manager, or user' })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserRole;
}
