import { IsString, IsOptional, IsUUID, IsDateString, MaxLength } from 'class-validator';

export class CreateCalendarEventDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsUUID()
  @IsOptional()
  changeId?: string;
}
