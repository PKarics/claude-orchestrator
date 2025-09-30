import { IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
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

  @IsOptional()
  @IsDateString()
  startedAt?: Date;

  @IsOptional()
  @IsDateString()
  completedAt?: Date;
}