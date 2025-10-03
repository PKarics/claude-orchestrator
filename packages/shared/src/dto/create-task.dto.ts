import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  timeout?: number;
}