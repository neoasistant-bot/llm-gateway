import { IsBoolean, IsOptional } from 'class-validator';

export class ExecuteMethodDto {
  input: any;

  @IsBoolean()
  @IsOptional()
  async?: boolean;
}
