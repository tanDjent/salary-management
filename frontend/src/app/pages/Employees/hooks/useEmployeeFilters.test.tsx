import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PAGE_SIZE, useEmployeeFilters } from "./useEmployeeFilters";

/** Renders the hook under a router seeded with a query string, and exposes the
 *  resulting URL so tests can assert on what a shared link would contain. */
function renderFilters(initialUrl = "/employees") {
  function wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>;
  }

  return renderHook(
    () => ({ ...useEmployeeFilters(), search: useLocation().search }),
    { wrapper },
  );
}

describe("status, mapped onto the API's two flags", () => {
  // The UI offers one dropdown; the API takes is_active and is_leaving
  // independently. Leaving narrows within active rather than sitting beside it,
  // so this mapping is where the two models could quietly disagree.
  it("sends nothing at all for 'all', so no one is excluded", () => {
    const { result } = renderFilters("/employees?status=all");

    expect(result.current.filters.is_active).toBeUndefined();
    expect(result.current.filters.is_leaving).toBeUndefined();
  });

  it("asks only for active, without constraining who is leaving", () => {
    const { result } = renderFilters("/employees?status=active");

    expect(result.current.filters.is_active).toBe(true);
    expect(result.current.filters.is_leaving).toBeUndefined();
  });

  it("asks only for leaving, and does not also pin is_active", () => {
    // Sending is_active: true here would be redundant, but sending false would
    // ask for a contradiction: nobody is both departed and serving notice.
    const { result } = renderFilters("/employees?status=leaving");

    expect(result.current.filters.is_leaving).toBe(true);
    expect(result.current.filters.is_active).toBeUndefined();
  });

  it("asks for inactive as is_active false, not as a missing flag", () => {
    const { result } = renderFilters("/employees?status=inactive");

    expect(result.current.filters.is_active).toBe(false);
    expect(result.current.filters.is_leaving).toBeUndefined();
  });

  it("falls back to 'all' when the URL carries a status that does not exist", () => {
    // URLs get hand-edited and outlive deploys, so an unknown value has to
    // degrade to the widest view rather than reaching the API.
    const { result } = renderFilters("/employees?status=retired");

    expect(result.current.status).toBe("all");
    expect(result.current.filters.is_active).toBeUndefined();
  });
});

describe("multi-value filters", () => {
  it("reads repeated params as a list, which the API ORs together", () => {
    const { result } = renderFilters("/employees?country_id=1&country_id=3");

    expect(result.current.countryIds).toEqual([1, 3]);
    expect(result.current.filters.country_id).toEqual([1, 3]);
  });

  it("omits an empty list rather than sending one, which would match nothing", () => {
    const { result } = renderFilters("/employees");

    expect(result.current.filters.country_id).toBeUndefined();
  });

  it("discards ids that are not positive integers", () => {
    const { result } = renderFilters(
      "/employees?country_id=1&country_id=abc&country_id=-2&country_id=1.5",
    );

    expect(result.current.countryIds).toEqual([1]);
  });
});

describe("pagination", () => {
  it("defaults to the first page, and refuses a nonsensical one", () => {
    expect(renderFilters("/employees").result.current.page).toBe(1);
    expect(renderFilters("/employees?page=0").result.current.page).toBe(1);
    expect(renderFilters("/employees?page=-4").result.current.page).toBe(1);
    expect(renderFilters("/employees?page=abc").result.current.page).toBe(1);
  });

  it("returns to page one when the filter changes", () => {
    // Page 8 of a 200-row result is meaningless once it narrows to 12 rows, and
    // the user would land on an empty table.
    const { result } = renderFilters("/employees?page=8");

    act(() => result.current.update({ q: "mercado" }));

    expect(result.current.page).toBe(1);
    expect(result.current.search).not.toContain("page=8");
  });

  it("stays on the page when only the sort changes", () => {
    // Re-sorting does not change which rows match, so throwing the user back to
    // page one would lose their place for no reason.
    const { result } = renderFilters("/employees?page=8");

    act(() => result.current.toggleSort("last_name"));

    expect(result.current.page).toBe(8);
  });
});

describe("sorting", () => {
  it("defaults to newest hires first", () => {
    const { result } = renderFilters("/employees");

    expect(result.current.sortBy).toBe("hire_date");
    expect(result.current.sortDir).toBe("desc");
  });

  it("sorts a newly clicked column ascending", () => {
    const { result } = renderFilters("/employees");

    act(() => result.current.toggleSort("last_name"));

    expect(result.current.sortBy).toBe("last_name");
    expect(result.current.sortDir).toBe("asc");
  });

  it("flips direction when the active column is clicked again", () => {
    const { result } = renderFilters("/employees");

    act(() => result.current.toggleSort("last_name"));
    act(() => result.current.toggleSort("last_name"));

    expect(result.current.sortDir).toBe("desc");
  });

  it("never lands in an unsorted state, so the default column stays responsive", () => {
    // A third "off" state would be indistinguishable from the hire_date default,
    // making that column's first click appear to do nothing.
    const { result } = renderFilters("/employees");

    act(() => result.current.toggleSort("hire_date"));
    expect(result.current.sortDir).toBe("asc");

    act(() => result.current.toggleSort("hire_date"));
    expect(result.current.sortDir).toBe("desc");
  });

  it("ignores a sort field the API does not accept", () => {
    const { result } = renderFilters("/employees?sort_by=salary");

    expect(result.current.sortBy).toBe("hire_date");
  });
});

describe("the filter count and clearing", () => {
  it("counts each selected value, not each populated filter", () => {
    const { result } = renderFilters(
      "/employees?country_id=1&country_id=3&department_id=2&q=priya&status=active",
    );

    // two countries, one department, one search, one status
    expect(result.current.activeFilterCount).toBe(5);
  });

  it("does not count 'all', which excludes nobody", () => {
    const { result } = renderFilters("/employees?status=all");

    expect(result.current.activeFilterCount).toBe(0);
  });

  it("empties the URL when cleared, rather than leaving stale params behind", () => {
    const { result } = renderFilters("/employees?country_id=1&q=priya&page=4");

    act(() => result.current.clearAll());

    expect(result.current.search).toBe("");
    expect(result.current.activeFilterCount).toBe(0);
  });
});

describe("the URL is the state", () => {
  it("puts filters in the URL so the view can be shared and survives a refresh", () => {
    const { result } = renderFilters("/employees");

    act(() => result.current.update({ country_id: [1, 3], q: "priya" }));

    const params = new URLSearchParams(result.current.search);
    expect(params.getAll("country_id")).toEqual(["1", "3"]);
    expect(params.get("q")).toBe("priya");
  });

  it("removes a param when its filter is emptied", () => {
    const { result } = renderFilters("/employees?q=priya&country_id=1");

    act(() => result.current.update({ q: "", country_id: [] }));

    expect(result.current.search).not.toContain("q=");
    expect(result.current.search).not.toContain("country_id");
  });

  it("always requests the page size the table is built for", () => {
    const { result } = renderFilters("/employees");

    expect(result.current.filters.page_size).toBe(PAGE_SIZE);
  });
});
