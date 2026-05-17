import { IsString, IsInt, IsOptional, Min, Max, Matches, MaxLength, IsNotEmpty } from 'class-validator';

export class ClaimDto {
  @IsString() @IsNotEmpty() @MaxLength(63)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug!: string;

  @IsString() @IsNotEmpty()
  serverIp!: string;

  @IsOptional() @IsInt() @Min(1) @Max(65535)
  serverPort?: number;

  @IsOptional() @IsString() @MaxLength(200)
  storeName?: string;
}

export class HeartbeatDto {
  @IsString() @IsNotEmpty() slug!: string;
  @IsString() @IsNotEmpty() serverIp!: string;
}
