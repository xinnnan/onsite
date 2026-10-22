import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { activeViewCount, applyTableView, columnValues, compareCells, EMPTY_TABLE_VIEW, toggleFilterValues, type TableColumn } from "../lib/table-view.ts";

type Project = { code: string; name: string; state: string | null; people: number };
const projects: Project[] = [
  { code: "PRJ-0010", name: "Walmart Atlanta", state: "GA", people: 3 },
  { code: "PRJ-0002", name: "adidas Indy", state: "IN", people: 12 },
  { code: "PRJ-0003", name: "Amazon Gary", state: "IN", people: 0 },
  { code: "PRJ-0001", name: "Target Austin", state: null, people: 5 },
];
const columns: TableColumn<Project>[] = [
  { key: "code", value: (row) => row.code },
  { key: "name", value: (row) => row.name },
  { key: "state", value: (row) => row.state },
  { key: "people", value: (row) => row.people },
];
const search = (row: Project) => `${row.code} ${row.name}`;
const codes = (rows: Project[]) => rows.map((row) => row.code);

describe("compareCells", () => {
  test("sorts codes naturally, numbers by size and blanks last", () => {
    assert.ok(compareCells("PRJ-0002", "PRJ-0010") < 0);
    assert.ok(compareCells(9, 10) < 0);
    assert.ok(compareCells("", "A") > 0);
    assert.ok(compareCells(null, "A") > 0);
    assert.equal(compareCells("adidas", "Adidas"), 0);
  });
});

describe("applyTableView", () => {
  test("leaves rows alone without a view", () => {
    assert.deepEqual(codes(applyTableView(projects, columns, EMPTY_TABLE_VIEW, search)), ["PRJ-0010", "PRJ-0002", "PRJ-0003", "PRJ-0001"]);
  });

  test("sorts both ways, keeping blanks last", () => {
    const byState = (direction: "asc" | "desc") => codes(applyTableView(projects, columns, { ...EMPTY_TABLE_VIEW, sort: { key: "state", direction } }, search));
    assert.deepEqual(byState("asc"), ["PRJ-0010", "PRJ-0002", "PRJ-0003", "PRJ-0001"]);
    assert.deepEqual(byState("desc"), ["PRJ-0002", "PRJ-0003", "PRJ-0010", "PRJ-0001"]);
    assert.deepEqual(codes(applyTableView(projects, columns, { ...EMPTY_TABLE_VIEW, sort: { key: "people", direction: "desc" } }, search)), ["PRJ-0002", "PRJ-0001", "PRJ-0010", "PRJ-0003"]);
  });

  test("keeps only the ticked values, blanks included", () => {
    assert.deepEqual(codes(applyTableView(projects, columns, { ...EMPTY_TABLE_VIEW, filters: { state: ["IN"] } }, search)), ["PRJ-0002", "PRJ-0003"]);
    assert.deepEqual(codes(applyTableView(projects, columns, { ...EMPTY_TABLE_VIEW, filters: { state: [""] } }, search)), ["PRJ-0001"]);
    assert.deepEqual(applyTableView(projects, columns, { ...EMPTY_TABLE_VIEW, filters: { state: [] } }, search), []);
  });

  test("matches every search word, in any case", () => {
    assert.deepEqual(codes(applyTableView(projects, columns, { ...EMPTY_TABLE_VIEW, search: " indy  ADIDAS " }, search)), ["PRJ-0002"]);
    assert.deepEqual(codes(applyTableView(projects, columns, { ...EMPTY_TABLE_VIEW, search: "prj-000" }, search)), ["PRJ-0002", "PRJ-0003", "PRJ-0001"]);
  });

  test("ignores filters and sorts on columns that no longer exist", () => {
    assert.equal(applyTableView(projects, columns, { search: "", filters: { gone: ["x"] }, sort: { key: "gone", direction: "asc" } }, search).length, 4);
  });
});

describe("columnValues", () => {
  test("lists each value once with its count, blanks last", () => {
    assert.deepEqual(columnValues(projects, columns[2]), [{ value: "GA", count: 1 }, { value: "IN", count: 2 }, { value: "", count: 1 }]);
    assert.deepEqual(columnValues(projects, columns[3]).map((entry) => entry.value), ["0", "3", "5", "12"]);
  });
});

describe("toggleFilterValues", () => {
  const all = ["GA", "IN", ""];
  test("unticking one value filters to the rest", () => {
    assert.deepEqual(toggleFilterValues({}, "state", all, ["IN"], false), { state: ["GA", ""] });
  });
  test("ticking everything again removes the filter", () => {
    assert.deepEqual(toggleFilterValues({ state: ["GA", ""], other: ["x"] }, "state", all, ["IN"], true), { other: ["x"] });
  });
  test("can untick everything, or a whole search result at once", () => {
    assert.deepEqual(toggleFilterValues({}, "state", all, all, false), { state: [] });
    assert.deepEqual(toggleFilterValues({ state: [] }, "state", all, ["GA", "IN"], true), { state: ["GA", "IN"] });
  });
});

describe("activeViewCount", () => {
  test("counts filtered columns, a sort and a search", () => {
    assert.equal(activeViewCount(EMPTY_TABLE_VIEW), 0);
    assert.equal(activeViewCount({ search: " x ", filters: { a: [], b: ["1"] }, sort: { key: "a", direction: "asc" } }), 4);
  });
});
