import { IsString, IsNotEmpty } from 'class-validator';

export class StartDownloadDto {
  @IsString()
  @IsNotEmpty()
  modelId: string;
}
