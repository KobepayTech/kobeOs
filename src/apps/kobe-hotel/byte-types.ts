export type HotelOrderSource = 'room-qr' | 'table-qr' | 'waiter' | 'pos' | 'lala' | 'delivery';
export type HotelStation = 'kitchen' | 'bar' | 'other';

export interface HotelRecipeLine {
  inventoryItemId: string;
  inventoryName?: string;
  quantity: number;
  unit: string;
}

export interface HotelRecipe {
  id: string;
  menuItemId: string;
  hotelId?: string | null;
  yield: number;
  ingredients: HotelRecipeLine[];
}

export interface InventoryConsumption {
  inventoryItemId: string;
  quantity: number;
  unit: string;
  menuItemId?: string;
  orderId?: string;
}

export interface OfflineHotelMutation {
  id: string;
  idempotencyKey: string;
  createdAt: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  attempts: number;
}

export function calculateRecipeConsumption(
  orderItems: Array<{ menuItemId?: string; qty: number }>,
  recipes: HotelRecipe[],
): InventoryConsumption[] {
  const byMenu = new Map(recipes.map((recipe) => [recipe.menuItemId, recipe]));
  const totals = new Map<string, InventoryConsumption>();

  for (const item of orderItems) {
    if (!item.menuItemId || item.qty <= 0) continue;
    const recipe = byMenu.get(item.menuItemId);
    if (!recipe) continue;
    const yieldQty = recipe.yield > 0 ? recipe.yield : 1;
    for (const ingredient of recipe.ingredients) {
      const quantity = (ingredient.quantity / yieldQty) * item.qty;
      const key = ingredient.inventoryItemId + ':' + ingredient.unit;
      const existing = totals.get(key);
      if (existing) existing.quantity += quantity;
      else totals.set(key, {
        inventoryItemId: ingredient.inventoryItemId,
        quantity,
        unit: ingredient.unit,
        menuItemId: item.menuItemId,
      });
    }
  }
  return [...totals.values()];
}
