export type BusinessType = "shop" | "hotel" | "restaurant";
export interface SetupProfile {
  businessType: BusinessType;
  businessName: string;
  location: string;
  phone: string;
  language: string;
  currency: string;
  timezone: string;
  completed?: boolean;
}
export const BUSINESS_GUIDES = {
  shop: {
    label: "Shop",
    bundle: "retail",
    noun: "product",
    question:
      "What sizes do you sell, what is the price, and how many of each size are in stock?",
    objective:
      "Review inventory and sales. Report low stock and top selling products. Suggest reorder quantities without placing orders.",
    modules: ["inventory", "erp", "reports"],
  },
  hotel: {
    label: "Hotel / Lala",
    bundle: "hospitality",
    noun: "room type",
    question:
      "What room type is this? What is the nightly rate, guest capacity, and which room numbers look like this?",
    objective:
      "Review room availability, bookings, and housekeeping. Report occupancy and rooms needing attention. Suggest actions without changing bookings.",
    modules: ["hotel", "reports"],
  },
  restaurant: {
    label: "Restaurant",
    bundle: "restaurants",
    noun: "dish",
    question:
      "What is this dish called? What portion size and price do you offer, and is it available today?",
    objective:
      "Review menu availability, orders, and inventory. Summarise popular dishes, unavailable items, and ingredient stock concerns. Suggest actions without changing the menu.",
    modules: ["hotel", "inventory", "reports"],
  },
} as const;
