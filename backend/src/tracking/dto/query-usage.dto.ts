import { IsOptional, IsString, IsEnum } from 'class-validator';

export class QueryUsageDto {
  @IsString()
  @IsOptional()
  dateFrom?: string;

  @IsString()
  @IsOptional()
  dateTo?: string;

  @IsString()
  @IsOptional()
  methodId?: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsEnum(['day', 'week', 'month'])
  @IsOptional()
  groupBy?: 'day' | 'week' | 'month' = 'day';
}
