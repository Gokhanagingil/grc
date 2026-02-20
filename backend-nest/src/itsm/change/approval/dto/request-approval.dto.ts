import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}
