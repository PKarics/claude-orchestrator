import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '../index';

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