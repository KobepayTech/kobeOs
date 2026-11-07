export type BusinessType = "shop" | "hotel" | "restaurant" | "other";
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

export const BUSINESS_GUIDES = {
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
