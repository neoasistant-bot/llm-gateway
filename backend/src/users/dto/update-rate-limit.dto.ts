import { IsInt, IsPositive, IsOptional } from 'class-validator';

export class UpdateRateLimitDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  rateLimitRpm?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  rateLimitTpd?: number;
}
