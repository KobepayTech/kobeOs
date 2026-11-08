export type BusinessType =
  "shop" | "hotel" | "restaurant" | "dealership" | "property" | "other";
export interface SetupProfile {
  businessType: BusinessType;
  businessName: string;
  location: string;
  phone: string;
  language: string;
  currency: string;
  timezone: string;
  displayName?: string;
  nameKind?: "personal" | "business" | "username";
  documentName?: string;
  employeeCount?: number;
  services?: string[];
  completed?: boolean;
}
export const DEFAULT_SETUP: SetupProfile = {
  businessType: "shop",
  businessName: "",
  location: "",
  phone: "",
  language: "English",
  currency: "TZS",
  timezone: "Africa/Dar_es_Salaam",
};

export type ListingType = "dealership" | "property";
export const OPEN_PHOTO_INTAKE = "kobe:open-photo-intake";
export const SHOP_PRODUCT_SAVED = "kobe:shop-product-saved";
export const LISTING_SAVED = "kobe:listing-saved";

export type PhotoIntakeRequest = {
  type: ListingType | "shop";
  business?: { name: string; phone?: string };
};

export function openPhotoIntake(
  type: PhotoIntakeRequest["type"],
  business?: PhotoIntakeRequest["business"],
) {
  window.dispatchEvent(
    new CustomEvent<PhotoIntakeRequest>(OPEN_PHOTO_INTAKE, {
      detail: { type, business },
    }),
  );
}

export const BUSINESS_GUIDES = {
  dealership: {
    label: "Car dealership",
    bundle: "automotive",
    noun: "vehicle",
    objective:
      "Summarise vehicle inventory and follow-up priorities from available business records.",
    modules: ["erp", "reports"],
  },
  property: {
    label: "Real estate",
    bundle: "property",
    noun: "property listing",
    objective:
      "Summarise the property portfolio, available units and follow-up priorities.",
    modules: ["property", "reports"],
  },
  other: {
    label: "Other business or personal",
    bundle: "office",
    noun: "item",
    objective:
      "Summarise business activity and suggest next steps using available reports.",
    modules: ["reports"],
  },
  shop: {
    label: "Shop",
    bundle: "retail",
    noun: "product",
    objective:
      "Review inventory and sales. Report low stock and top selling products. Suggest reorder quantities without placing orders.",
    modules: ["inventory", "erp", "reports"],
  },
  hotel: {
    label: "Hotel / Lala",
    bundle: "hospitality",
    noun: "room type",
    objective:
      "Review room availability, bookings, and housekeeping. Report occupancy and rooms needing attention. Suggest actions without changing bookings.",
    modules: ["hotel", "reports"],
  },
  restaurant: {
    label: "Restaurant",
    bundle: "restaurants",
    noun: "dish",
    objective:
      "Review menu availability, orders, and inventory. Summarise popular dishes, unavailable items, and ingredient stock concerns. Suggest actions without changing the menu.",
    modules: ["hotel", "inventory", "reports"],
  },
} as const;
