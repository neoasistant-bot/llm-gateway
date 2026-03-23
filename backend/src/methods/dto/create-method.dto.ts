import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { Provider, InputType } from '../../../generated/prisma/client';

export class CreateMethodDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(InputType)
  inputType?: InputType = InputType.TEXT;

  @IsString()
  @IsNotEmpty()
  promptTemplate: string;

  @IsEnum(Provider)
  @IsNotEmpty()
  provider: Provider;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = false;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
