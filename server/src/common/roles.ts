/**
 * All platform roles.
 * Used in User.role, JWT payload, @Roles() decorator, and canAccess() on the frontend.
 */
export const ROLES = [
  'admin',           // Full platform access
  'user',            // Default authenticated user
  'creator',         // Influencer/content creator
  'brand',           // Advertiser / brand manager
  'cashier_tz',      // Tanzania cashier
  'cashier_china',   // China cashier
  'cashier_india',   // India cashier
  'manager_tz',      // Tanzania manager — reconciliation + verification
  'manager_abroad',  // China/India manager — reconciliation + verification
] as const;

export type AppRole = typeof ROLES[number];

/** Roles that can access admin-level endpoints */
export const ADMIN_ROLES: AppRole[] = ['admin'];

/** Roles that can manage campaigns and escrow */
export const CAMPAIGN_ROLES: AppRole[] = ['admin', 'brand', 'creator'];

/** Roles that can perform cashier operations */
export const CASHIER_ROLES: AppRole[] = ['admin', 'cashier_tz', 'cashier_china', 'cashier_india', 'manager_tz', 'manager_abroad'];

/** Roles that can perform manager verification */
export const MANAGER_ROLES: AppRole[] = ['admin', 'manager_tz', 'manager_abroad'];
