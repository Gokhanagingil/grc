import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UserNotificationFilterDto {
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  unreadOnly?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
