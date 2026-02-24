import { IsUUID, IsNotEmpty } from 'class-validator';

export class AddDependencyDto {
  @IsUUID('4')
  @IsNotEmpty()
  predecessorTaskId: string;

  @IsUUID('4')
  @IsNotEmpty()
  successorTaskId: string;
}

export class RemoveDependencyDto {
  @IsUUID('4')
  @IsNotEmpty()
  predecessorTaskId: string;

  @IsUUID('4')
  @IsNotEmpty()
  successorTaskId: string;
}
