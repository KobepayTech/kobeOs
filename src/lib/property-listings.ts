export interface PropertyListing {
  id: string;
  title: string;
  kind: string;
  offer: "RENT" | "SALE";
  price: number | string;
  currency: string;
  location: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaM2?: number | string | null;
  description: string;
  amenities: string[];
  contactPhone: string;
  imageUrls: string[];
  published?: boolean;
}
