import { IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
import { TaskStatus } from '../index';

export class UpdateTaskDto {
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @IsString()
  @IsOptional()
  workerId?: string;

  @IsString()
  @IsOptional()
  result?: string;

  @IsString()
  @IsOptional()
  errorMessage?: string;

  @IsDateString()
  @IsOptional()
  startedAt?: Date;

  @IsDateString()
  @IsOptional()
  completedAt?: Date;
}