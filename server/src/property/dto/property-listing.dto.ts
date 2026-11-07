import { BadRequestException } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class PropertyListingDto {
  @IsString() @MaxLength(120) title!: string;
  @IsIn(['Apartment', 'House', 'Land', 'Office', 'Shop', 'Warehouse', 'Other']) kind!: string;
  @IsIn(['RENT', 'SALE']) offer!: 'RENT' | 'SALE';
  @IsNumber() @Min(0.01) @Max(1e12) price!: number;
  @IsString() @MaxLength(160) location!: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) bedrooms?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000) bathrooms?: number | null;
  @IsOptional() @IsNumber() @Min(0.01) @Max(1e9) areaM2?: number | null;
  @IsString() @MaxLength(4000) description!: string;
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) @MaxLength(100, { each: true }) amenities!: string[];
  @Matches(/^\+?[\d ()-]{7,24}$/) contactPhone!: string;
  @IsBoolean() published!: boolean;
}

export function checkedListing(dto: PropertyListingDto) {
  const title = dto.title.trim();
  const location = dto.location.trim();
  if (!title || !location) throw new BadRequestException('Enter a title and location');
  if (dto.contactPhone.replace(/\D/g, '').length < 7) throw new BadRequestException('Enter a valid public contact number');
  return { ...dto, title, location, description: dto.description.trim(), amenities: dto.amenities.map(a => a.trim()).filter(Boolean) };
}
