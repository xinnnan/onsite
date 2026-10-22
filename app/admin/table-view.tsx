"use client";

import { ArrowDownAZ, ArrowDownZA, ChevronDown, FilterX, ListFilter, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/app/lib/use-language";
import { activeViewCount, applyTableView, columnValues, EMPTY_TABLE_VIEW, toggleFilterValues, type TableColumn, type TableViewState } from "@/lib/table-view";

export type ViewColumn<Row> = TableColumn<Row> & {
  label: string;
  /** Offers a value checklist in the column menu; every column can be sorted. */
  filterable?: boolean;
  /** How a cell value reads in the checklist, such as a localized status. */
  valueLabel?: (value: string) => string;
};

export const tableViewText = {
  zh: { sortAsc:"升序", sortDesc:"降序", searchValues:"搜索…", selectAll:"全选", selectResults:"全选搜索结果", blank:"（空白）", clearColumn:"清除此列筛选", clearAll:"清除筛选", noValues:"没有匹配的值", showing:(shown:number,total:number)=>`显示 ${shown} / ${total}`, noRows:"没有符合筛选条件的记录", menu:(label:string)=>`${label}：排序和筛选` },
  en: { sortAsc:"Sort A to Z", sortDesc:"Sort Z to A", searchValues:"Search…", selectAll:"Select all", selectResults:"Select all results", blank:"(Blank)", clearColumn:"Clear this filter", clearAll:"Clear filters", noValues:"No matching values", showing:(shown:number,total:number)=>`Showing ${shown} of ${total}`, noRows:"No rows match these filters", menu:(label:string)=>`${label}: sort and filter` },
  es: { sortAsc:"Orden ascendente", sortDesc:"Orden descendente", searchValues:"Buscar…", selectAll:"Seleccionar todo", selectResults:"Seleccionar resultados", blank:"(Vacío)", clearColumn:"Quitar este filtro", clearAll:"Quitar filtros", noValues:"No hay valores", showing:(shown:number,total:number)=>`Mostrando ${shown} de ${total}`, noRows:"Ninguna fila coincide con los filtros", menu:(label:string)=>`${label}: ordenar y filtrar` },
  ko: { sortAsc:"오름차순", sortDesc:"내림차순", searchValues:"검색…", selectAll:"전체 선택", selectResults:"검색 결과 전체 선택", blank:"(비어 있음)", clearColumn:"이 열 필터 지우기", clearAll:"필터 지우기", noValues:"일치하는 값이 없습니다", showing:(shown:number,total:number)=>`${total}개 중 ${shown}개 표시`, noRows:"필터와 일치하는 항목이 없습니다", menu:(label:string)=>`${label}: 정렬 및 필터` },
} as const;

function readStoredView(storageKey: string): TableViewState {
  if (typeof window === "undefined") return EMPTY_TABLE_VIEW;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(storageKey) || "null") as Partial<TableViewState> | null;
    if (!stored || typeof stored !== "object") return EMPTY_TABLE_VIEW;
    return { search: typeof stored.search === "string" ? stored.search : "", filters: stored.filters && typeof stored.filters === "object" ? stored.filters : {}, sort: stored.sort ?? null };
  } catch { return EMPTY_TABLE_VIEW; }
}

/**
 * Search, column filters and sort for a table, kept for the browser tab so leaving for a detail
 * page and coming back keeps the view.
 */
export function useTableView<Row>(rows: readonly Row[], columns: readonly ViewColumn<Row>[], searchText: (row: Row) => string, storageKey: string) {
  const [view, setView] = useState<TableViewState>(() => readStoredView(storageKey));
  useEffect(() => {
    try { window.sessionStorage.setItem(storageKey, JSON.stringify(view)); } catch { /* The view still works without storage. */ }
  }, [storageKey, view]);
  const visible = useMemo(() => applyTableView(rows, columns, view, searchText), [rows, columns, view, searchText]);
  return { view, setView, rows: visible, total: rows.length, active: activeViewCount(view), clear: () => setView(EMPTY_TABLE_VIEW), allRows: rows };
}

type TableView<Row> = ReturnType<typeof useTableView<Row>>;

/** A header cell whose menu sorts the table and, for filterable columns, ticks which values show. */
export function ColumnHeader<Row>({ table, column, locale }: { table: TableView<Row>; column: ViewColumn<Row>; locale: Locale }) {
  const copy = tableViewText[locale] || tableViewText.en;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sorted = table.view.sort?.key === column.key ? table.view.sort.direction : null;
  const filtered = Boolean(table.view.filters[column.key]);

  useEffect(() => {
    if (!open) return;
    function outside(event: Event) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); } }
    function close() { setOpen(false); }
    // Keyboard users land in the menu: on its search box, or its first sort button.
    menuRef.current?.querySelector<HTMLElement>(".column-menu-search input, button")?.focus();
    // The menu is placed against the window, so scrolling the page or the table, or resizing, closes it.
    window.addEventListener("mousedown", outside);
    window.addEventListener("scroll", outside, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", escape);
    return () => { window.removeEventListener("mousedown", outside); window.removeEventListener("scroll", outside, true); window.removeEventListener("resize", close); window.removeEventListener("keydown", escape); };
  }, [open]);

  function toggle() {
    if (!open && buttonRef.current) {
      const box = buttonRef.current.getBoundingClientRect();
      setPosition({ top: box.bottom + 6, left: Math.max(8, Math.min(box.left - 8, window.innerWidth - 276)) });
      setQuery("");
    }
    setOpen(!open);
  }

  function sort(direction: "asc" | "desc") {
    table.setView((current) => ({ ...current, sort: current.sort?.key === column.key && current.sort.direction === direction ? null : { key: column.key, direction } }));
  }

  const values = useMemo(() => open && column.filterable ? columnValues(table.allRows, column) : [], [open, column, table.allRows]);
  const label = (value: string) => value ? (column.valueLabel?.(value) ?? value) : copy.blank;
  const needle = query.trim().toLocaleLowerCase();
  const shownValues = needle ? values.filter((entry) => label(entry.value).toLocaleLowerCase().includes(needle)) : values;
  const allValues = values.map((entry) => entry.value);
  const kept = table.view.filters[column.key];
  const isKept = (value: string) => !kept || kept.includes(value);
  const allShownKept = shownValues.length > 0 && shownValues.every((entry) => isKept(entry.value));
  const someShownKept = shownValues.some((entry) => isKept(entry.value));
  const setValues = (changed: string[], checked: boolean) => table.setView((current) => ({ ...current, filters: toggleFilterValues(current.filters, column.key, allValues, changed, checked) }));

  return <th aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
    <button ref={buttonRef} type="button" className={`column-head ${sorted || filtered ? "active" : ""}`} aria-haspopup="dialog" aria-expanded={open} aria-label={copy.menu(column.label)} onClick={toggle}>
      <span>{column.label}</span>
      {filtered ? <ListFilter size={13}/> : sorted === "asc" ? <ArrowDownAZ size={13}/> : sorted === "desc" ? <ArrowDownZA size={13}/> : <ChevronDown size={13}/>}
    </button>
    {open && <div ref={menuRef} className="column-menu" role="dialog" aria-label={copy.menu(column.label)} style={position}>
      <div className="column-menu-sort">
        <button type="button" className={sorted === "asc" ? "active" : ""} aria-pressed={sorted === "asc"} onClick={() => sort("asc")}><ArrowDownAZ size={15}/>{copy.sortAsc}</button>
        <button type="button" className={sorted === "desc" ? "active" : ""} aria-pressed={sorted === "desc"} onClick={() => sort("desc")}><ArrowDownZA size={15}/>{copy.sortDesc}</button>
      </div>
      {column.filterable && <>
        <label className="column-menu-search"><Search size={14}/><input value={query} placeholder={copy.searchValues} aria-label={copy.searchValues} onChange={(event) => setQuery(event.target.value)}/></label>
        <div className="column-menu-values">
          {shownValues.length > 0 && <label className="column-menu-all"><input type="checkbox" checked={allShownKept} ref={(input) => { if (input) input.indeterminate = someShownKept && !allShownKept; }} onChange={(event) => setValues(shownValues.map((entry) => entry.value), event.target.checked)}/><span>{needle ? copy.selectResults : copy.selectAll}</span></label>}
          {shownValues.map((entry) => <label key={entry.value}><input type="checkbox" checked={isKept(entry.value)} onChange={(event) => setValues([entry.value], event.target.checked)}/><span>{label(entry.value)}</span><small>{entry.count}</small></label>)}
          {!shownValues.length && <p>{copy.noValues}</p>}
        </div>
        <button type="button" className="column-menu-clear" disabled={!filtered} onClick={() => table.setView((current) => { const { [column.key]: _cleared, ...filters } = current.filters; void _cleared; return { ...current, filters }; })}><FilterX size={14}/>{copy.clearColumn}</button>
      </>}
    </div>}
  </th>;
}
