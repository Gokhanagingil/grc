import { IsString, IsObject, IsOptional, MaxLength } from 'class-validator';

export class RunToolDto {
  @IsString()
  @MaxLength(50)
  toolKey: string;

  @IsObject()
  input: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  runId?: string;
}
