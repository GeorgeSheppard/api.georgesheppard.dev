import { Unit } from '@core/types/recipes.js';

export interface IQuantity {
  unit: Unit;
  value?: number;
}

export class Quantities {
  static toString(quantity: IQuantity): string | null {
    const { value, unit } = quantity;

    if (value === undefined || value === null) {
      return null;
    }

    if (unit === Unit.NO_UNIT) {
      return value.toString();
    }

    return `${value} ${unit}`;
  }
}
