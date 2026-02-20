import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class PreviewConflictsDto {
  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsUUID()
  @IsOptional()
  changeId?: string;

  @IsUUID()
  @IsOptional()
  serviceId?: string;
}
