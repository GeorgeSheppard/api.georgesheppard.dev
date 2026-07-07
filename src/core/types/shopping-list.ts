/**
 * Shopping list type definitions for Mise backend
 */

export interface IShoppingListItem {
  ingredient: string;
  quantities: Array<{ unit: string; value?: number }>;
  category: string;
  meals: string[];
}

export interface IStoredShoppingList {
  items: IShoppingListItem[];
  generatedAt: number; // Unix timestamp in milliseconds
}
