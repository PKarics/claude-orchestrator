import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '../../../types/task-status.enum';

export class UpdateTaskDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  workerId?: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsString()
  errorMessage?: string;
}