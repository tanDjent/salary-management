import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type {
  EmployeeFilters,
  EmployeeSortField,
  SortDirection,
} from "../../../../api/employees";

export const PAGE_SIZE = 15;

const SORT_FIELDS: EmployeeSortField[] = [
  "last_name",
  "first_name",
  "hire_date",
  "salary_usd",
];

/** "leaving" is a subset of "active" rather than a fourth state: those people are
 *  still employed, just with a departure already scheduled. */
export type StatusFilter = "all" | "active" | "leaving" | "inactive";

const STATUS_FILTERS: StatusFilter[] = ["all", "active", "leaving", "inactive"];

/** Maps the single-select the UI offers onto the two independent flags the API
 *  takes, since leaving narrows within active rather than replacing it. */
function statusToParams(status: StatusFilter): {
  is_active?: boolean;
  is_leaving?: boolean;
} {
  switch (status) {
    case "active":
      return { is_active: true };
    case "leaving":
      return { is_leaving: true };
    case "inactive":
      return { is_active: false };
    default:
      return {};
  }
}

/**
 * Filter state lives in the URL rather than React state.
 *
 * That makes a filtered view shareable and bookmarkable, survives a refresh, and
 * makes the browser back button behave the way the user expects.
 */
export function useEmployeeFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const numbers = useCallback(
    (key: string) =>
      searchParams
        .getAll(key)
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0),
    [searchParams],
  );

  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const q = searchParams.get("q") ?? "";
  const rawStatus = searchParams.get("status") as StatusFilter | null;
  const status: StatusFilter =
    rawStatus && STATUS_FILTERS.includes(rawStatus) ? rawStatus : "all";

  const rawSortBy = searchParams.get("sort_by") as EmployeeSortField | null;
  const sortBy: EmployeeSortField =
    rawSortBy && SORT_FIELDS.includes(rawSortBy) ? rawSortBy : "hire_date";
  const sortDir: SortDirection = searchParams.get("sort_dir") === "asc" ? "asc" : "desc";

  const countryIds = useMemo(() => numbers("country_id"), [numbers]);
  const departmentIds = useMemo(() => numbers("department_id"), [numbers]);
  const jobLevelIds = useMemo(() => numbers("job_level_id"), [numbers]);

  const update = useCallback(
    (changes: Record<string, string | number | number[] | undefined>, resetPage = true) => {
      const next = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(changes)) {
        next.delete(key);
        if (value === undefined || value === "") continue;

        if (Array.isArray(value)) value.forEach((item) => next.append(key, String(item)));
        else next.set(key, String(value));
      }

      // Any change to what is being filtered invalidates the current page number:
      // page 8 of a 200-row result is meaningless once it narrows to 12 rows.
      if (resetPage) next.delete("page");

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  /**
   * Click a new column to sort it ascending; click the active column to flip it.
   *
   * There is deliberately no third "unsorted" state. A list always comes back in
   * some order, so clearing the sort just falls back to hire_date descending —
   * which is indistinguishable from sorting by hire_date descending. That made
   * the default column appear unresponsive: its first click reset to a state it
   * was already in.
   */
  const toggleSort = useCallback(
    (field: string) => {
      const nextField = field as EmployeeSortField;
      const nextDir: SortDirection =
        sortBy === nextField && sortDir === "asc" ? "desc" : "asc";

      update({ sort_by: nextField, sort_dir: nextDir }, false);
    },
    [sortBy, sortDir, update],
  );

  const filters: EmployeeFilters = useMemo(
    () => ({
      page,
      page_size: PAGE_SIZE,
      q: q || undefined,
      country_id: countryIds.length ? countryIds : undefined,
      department_id: departmentIds.length ? departmentIds : undefined,
      job_level_id: jobLevelIds.length ? jobLevelIds : undefined,
      ...statusToParams(status),
      sort_by: sortBy,
      sort_dir: sortDir,
    }),
    [page, q, countryIds, departmentIds, jobLevelIds, status, sortBy, sortDir],
  );

  const activeFilterCount =
    countryIds.length +
    departmentIds.length +
    jobLevelIds.length +
    (status === "all" ? 0 : 1) +
    (q ? 1 : 0);

  const clearAll = useCallback(() => setSearchParams({}, { replace: true }), [
    setSearchParams,
  ]);

  return {
    filters,
    page,
    q,
    status,
    countryIds,
    departmentIds,
    jobLevelIds,
    sortBy,
    sortDir,
    activeFilterCount,
    update,
    toggleSort,
    clearAll,
  };
}
