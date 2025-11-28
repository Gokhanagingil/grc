import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class LoginDto {
  @Matches(
    /^[^\s@]+@[^\s@]+$/,
    { message: 'Email must be a valid email address' },
  )
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(4, { message: 'Password must be at least 4 characters long' })
  password!: string;

  @IsString({ message: 'MFA code must be a string' })
  mfaCode?: string;
}

