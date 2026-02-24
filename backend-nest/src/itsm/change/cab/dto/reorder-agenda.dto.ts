import { IsArray, IsUUID } from 'class-validator';

export class ReorderAgendaDto {
  @IsArray()
  @IsUUID('4', { each: true })
  itemIds: string[];
}
