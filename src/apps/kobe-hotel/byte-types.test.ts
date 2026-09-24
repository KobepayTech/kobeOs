import { describe, expect, it } from 'vitest';
import { calculateRecipeConsumption } from './byte-types';

describe('calculateRecipeConsumption', () => {
  it('scales BOM ingredients by ordered quantity and recipe yield', () => {
    const result = calculateRecipeConsumption(
      [{ menuItemId: 'burger', qty: 4 }],
      [{ id: 'r1', menuItemId: 'burger', yield: 2, ingredients: [
        { inventoryItemId: 'bun', quantity: 2, unit: 'piece' },
        { inventoryItemId: 'chicken', quantity: 300, unit: 'g' },
      ] }],
    );
    expect(result).toEqual([
      { inventoryItemId: 'bun', quantity: 4, unit: 'piece', menuItemId: 'burger' },
      { inventoryItemId: 'chicken', quantity: 600, unit: 'g', menuItemId: 'burger' },
    ]);
  });
  it('combines repeated inventory lines', () => {
    const result = calculateRecipeConsumption(
      [{ menuItemId: 'tea', qty: 2 }, { menuItemId: 'coffee', qty: 1 }],
      [
        { id: 'r1', menuItemId: 'tea', yield: 1, ingredients: [{ inventoryItemId: 'sugar', quantity: 10, unit: 'g' }] },
        { id: 'r2', menuItemId: 'coffee', yield: 1, ingredients: [{ inventoryItemId: 'sugar', quantity: 5, unit: 'g' }] },
      ],
    );
    expect(result[0].quantity).toBe(25);
  });
});
