import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsInt()
  @Min(1)
  @Max(3600)
  @IsOptional()
  timeout?: number = 300;
}