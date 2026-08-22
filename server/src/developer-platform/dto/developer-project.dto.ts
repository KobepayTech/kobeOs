import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDeveloperProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUrl({ require_tld: false }, { each: true })
  allowedOrigins?: string[];
}

export class DeveloperPromptDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8_000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  system?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;
}

export class DeveloperEmbedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  text!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;
}

export class DeveloperCodeDto extends DeveloperPromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string;
}
