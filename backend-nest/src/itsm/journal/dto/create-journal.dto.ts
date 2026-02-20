import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { JournalType } from '../journal.entity';

export class CreateJournalDto {
  @IsEnum(JournalType)
  type: JournalType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  message: string;
}
