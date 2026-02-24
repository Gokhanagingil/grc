import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { CabMeetingStatus } from '../cab-meeting.entity';

export class CreateCabMeetingDto {
  @IsString()
  title: string;

  @IsDateString()
  meetingAt: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsEnum(CabMeetingStatus)
  status?: string;

  @IsOptional()
  @IsUUID()
  chairpersonId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  summary?: string;
}
