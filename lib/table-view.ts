/** Spreadsheet-style filtering and sorting for admin tables, kept free of React so it can be tested. */

export type CellValue = string | number | null | undefined;
export type TableColumn<Row> = { key: string; value: (row: Row) => CellValue };
export type TableSort = { key: string; direction: "asc" | "desc" } | null;
/** The values each filtered column keeps, as cell text; a column without an entry shows everything. */
export type TableFilters = Record<string, string[]>;
export type TableViewState = { search: string; filters: TableFilters; sort: TableSort };

export const EMPTY_TABLE_VIEW: TableViewState = { search: "", filters: {}, sort: null };

/** A cell as filters see it; blanks are "" and sit after every other value. */
export function cellText(value: CellValue) {
  return value == null ? "" : String(value).trim();
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** Orders numbers by size and text naturally (PRJ-0002 before PRJ-0010); blanks always come last. */
export function compareCells(a: CellValue, b: CellValue) {
  const left = cellText(a);
  const right = cellText(b);
  if (!left || !right) return left ? -1 : right ? 1 : 0;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return collator.compare(left, right);
}

/** Each distinct value in a column with how many rows have it, in sort order. */
export function columnValues<Row>(rows: readonly Row[], column: TableColumn<Row>) {
  const counts = new Map<string, { value: string; raw: CellValue; count: number }>();
  for (const row of rows) {
    const raw = column.value(row);
    const value = cellText(raw);
    const entry = counts.get(value);
    if (entry) entry.count += 1;
    else counts.set(value, { value, raw, count: 1 });
  }
  return [...counts.values()].sort((a, b) => compareCells(a.raw, b.raw)).map(({ value, count }) => ({ value, count }));
}

/**
 * Ticks or unticks values in a column filter. Returns the new filters; a column whose every value is
 * ticked again drops its filter, as in a spreadsheet.
 */
export function toggleFilterValues(filters: TableFilters, key: string, allValues: readonly string[], values: readonly string[], checked: boolean): TableFilters {
  const selected = new Set(filters[key] ?? allValues);
  for (const value of values) {
    if (checked) selected.add(value);
    else selected.delete(value);
  }
  const { [key]: _removed, ...rest } = filters;
  void _removed;
  return allValues.every((value) => selected.has(value)) ? rest : { ...rest, [key]: allValues.filter((value) => selected.has(value)) };
}

/** Rows that match the search words and every column filter, in the chosen order. */
export function applyTableView<Row>(rows: readonly Row[], columns: readonly TableColumn<Row>[], view: TableViewState, searchText: (row: Row) => string) {
  const words = view.search.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const filters = columns.flatMap((column) => {
    const kept = view.filters[column.key];
    return kept ? [{ column, kept: new Set(kept) }] : [];
  });
  const visible = rows.filter((row) => {
    const text = words.length ? searchText(row).toLocaleLowerCase() : "";
    return words.every((word) => text.includes(word)) && filters.every(({ column, kept }) => kept.has(cellText(column.value(row))));
  });
  const sortColumn = view.sort && columns.find((column) => column.key === view.sort?.key);
  if (!sortColumn || !view.sort) return visible;
  const direction = view.sort.direction === "asc" ? 1 : -1;
  // Blanks stay last whichever way the column is sorted; ties keep their original order.
  return visible.map((row, index) => ({ row, index, value: sortColumn.value(row) })).sort((a, b) => {
    const aBlank = !cellText(a.value);
    const bBlank = !cellText(b.value);
    if (aBlank !== bBlank) return aBlank ? 1 : -1;
    return compareCells(a.value, b.value) * direction || a.index - b.index;
  }).map(({ row }) => row);
}

/** How many columns are filtered or sorted, plus one for a search, for "clear" buttons. */
export function activeViewCount(view: TableViewState) {
  return Object.keys(view.filters).length + (view.sort ? 1 : 0) + (view.search.trim() ? 1 : 0);
}
