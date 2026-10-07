export type ColumnSpec = {
  key: string;
  min: number;
  max?: number;
  weight?: number;
};

/**
 * Lays out table columns in pixels: resized columns keep their width, the others start at their
 * minimum and share any spare width by weight up to their maximum. Spare width nobody can take
 * is left over, so the table may end up narrower than `available`.
 */
export function fitColumnWidths(available: number, columns: readonly ColumnSpec[], overrides: Record<string, number> = {}) {
  const widths: Record<string, number> = {};
  for (const column of columns) {
    const override = overrides[column.key];
    widths[column.key] = override == null ? column.min : Math.max(column.min, Math.round(override));
  }
  let remaining = Math.floor(available) - Object.values(widths).reduce((sum, width) => sum + width, 0);
  let flexible = columns.filter((column) => overrides[column.key] == null && (column.weight || 0) > 0);
  while (remaining > 0 && flexible.length) {
    const totalWeight = flexible.reduce((sum, column) => sum + (column.weight || 0), 0);
    const stillFlexible: ColumnSpec[] = [];
    let used = 0;
    for (const column of flexible) {
      const room = column.max == null ? Infinity : column.max - widths[column.key];
      const grow = Math.min((remaining * (column.weight || 0)) / totalWeight, room);
      widths[column.key] += grow;
      used += grow;
      if (grow < room) stillFlexible.push(column);
    }
    remaining -= used;
    if (stillFlexible.length === flexible.length) break;
    flexible = stillFlexible;
  }

  const exactTotal = Math.round(Object.values(widths).reduce((sum, width) => sum + width, 0));
  for (const key of Object.keys(widths)) widths[key] = Math.floor(widths[key]);
  const shortfall = exactTotal - Object.values(widths).reduce((sum, width) => sum + width, 0);
  const absorber = flexible.reduce<ColumnSpec | null>((best, column) => (!best || (column.weight || 0) > (best.weight || 0) ? column : best), null);
  if (shortfall > 0 && absorber) widths[absorber.key] += shortfall;
  return widths;
}
