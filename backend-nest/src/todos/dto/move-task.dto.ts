import { IsString, IsNumber } from 'class-validator';

export class MoveTaskDto {
  @IsString()
  toColumnKey: string;

  @IsNumber()
  toIndex: number;
}
