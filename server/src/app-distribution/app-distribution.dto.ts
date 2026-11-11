import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
export class InstallDeveloperAppDto {
  @IsUUID() releaseId!: string;
  @IsArray() @ArrayMaxSize(1) @ArrayUnique() @IsIn(['inventory.read'], { each: true }) grants!: string[];
}
export class ReviewDeveloperAppDto {
  @IsIn(['approve', 'reject', 'revoke']) decision!: 'approve' | 'reject' | 'revoke';
  @IsString() @MaxLength(1000) note!: string;
}
