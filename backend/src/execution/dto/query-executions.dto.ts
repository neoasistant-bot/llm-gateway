import { IsOptional, IsNumber, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ExecutionStatus } from '../../generated/prisma/client';

export class QueryExecutionsDto {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;

  @IsString()
  @IsOptional()
  methodId?: string;

  @IsEnum(ExecutionStatus)
  @IsOptional()
  status?: ExecutionStatus;

  @IsString()
  @IsOptional()
  dateFrom?: string;

  @IsString()
  @IsOptional()
  dateTo?: string;

  @IsString()
  @IsOptional()
  userId?: string;
}
