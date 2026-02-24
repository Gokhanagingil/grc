import { IsUUID, IsOptional, IsInt } from 'class-validator';

export class AddAgendaItemDto {
  @IsUUID()
  changeId: string;

  @IsOptional()
  @IsInt()
  orderIndex?: number;
}
