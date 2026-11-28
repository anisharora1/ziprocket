/**
 * Partitions items so in-stock products appear first and out-of-stock products
 * (isAvailable === false or stockQuantity <= 0) appear last, preserving
 * relative server order within each group.
 */
export function sortAvailableFirst<
  T extends { isAvailable?: boolean; stockQuantity?: number }
>(items: T[]): T[] {
  const available: T[] = [];
  const outOfStock: T[] = [];

  for (const item of items) {
    const isOut =
      item.isAvailable === false ||
      (item.stockQuantity !== undefined && item.stockQuantity <= 0);
    if (isOut) {
      outOfStock.push(item);
    } else {
      available.push(item);
    }
  }

  return [...available, ...outOfStock];
}
