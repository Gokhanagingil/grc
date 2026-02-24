import { IsOptional, IsString, IsNumberString } from 'class-validator';

export const CAB_MEETING_SORTABLE_FIELDS = [
  'meetingAt',
  'status',
  'title',
  'code',
  'createdAt',
  'updatedAt',
];

export class CabMeetingFilterDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  pageSize?: number;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortOrder?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
