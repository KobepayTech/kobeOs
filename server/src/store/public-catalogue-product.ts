import type { PosProduct } from '../pos/pos.entity';

export function publicCatalogueProduct(product: PosProduct) {
  const listing = { ...product };
  delete listing.cost;
  delete listing.supplier;
  delete listing.discountReferencePrice;
  return listing;
}
