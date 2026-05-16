import { plainToInstance } from 'class-transformer';
import { IsString, IsNumber, IsEnum, IsOptional, validateSync, MinLength } from 'class-validator';

class EnvVars {
  @IsString() @MinLength(32) JWT_SECRET!: string;
  @IsNumber() PORT!: number;
  @IsEnum(['development', 'production', 'test']) NODE_ENV!: string;
  @IsString() DB_HOST!: string;
  @IsNumber() DB_PORT!: number;
  @IsString() DB_USERNAME!: string;
  @IsString() DB_PASSWORD!: string;
  @IsString() DB_DATABASE!: string;
  @IsOptional() @IsString() SENDGRID_API_KEY?: string;
  @IsOptional() @IsString() SMTP_HOST?: string;
  @IsOptional() @IsNumber() SMTP_PORT?: number;
  @IsOptional() @IsString() SMTP_USER?: string;
  @IsOptional() @IsString() SMTP_PASS?: string;
  @IsOptional() @IsString() REDIS_URL?: string;
  @IsOptional() @IsString() WEBHOOK_SECRET?: string;
  @IsOptional() @IsString() OLLAMA_URL?: string;
  @IsOptional() @IsString() OLLAMA_MODEL?: string;
  @IsOptional() @IsString() FOOTBALL_DATA_API_KEY?: string;
  @IsOptional() @IsString() API_FOOTBALL_KEY?: string;
  /** Base URL of the Kobe Model CDN, e.g. https://models.kobe or a self-hosted MinIO endpoint */
  @IsOptional() @IsString() KOBE_MODELS_CDN_URL?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length) {
    const messages = errors.map((e) => `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Environment validation failed:\n${messages.join('\n')}`);
  }
  return validated;
}
