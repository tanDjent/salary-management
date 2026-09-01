import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import type { AnalyticsFilters } from "../../../../api/analytics";

/**
 * Dashboard filter state, kept in the URL for the same reasons the directory's is:
 * a filtered view stays shareable, survives a refresh, and the back button works.
 */
export function useAnalyticsFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const numbers = useCallback(
    (key: string) =>
      searchParams
        .getAll(key)
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0),
    [searchParams],
  );

  const countryIds = useMemo(() => numbers("country_id"), [numbers]);
  const departmentIds = useMemo(() => numbers("department_id"), [numbers]);
  const jobLevelIds = useMemo(() => numbers("job_level_id"), [numbers]);

  const update = useCallback(
    (changes: Record<string, number[] | undefined>) => {
      const next = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(changes)) {
        next.delete(key);
        value?.forEach((item) => next.append(key, String(item)));
      }

      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const filters: AnalyticsFilters = useMemo(
    () => ({
      country_id: countryIds.length ? countryIds : undefined,
      department_id: departmentIds.length ? departmentIds : undefined,
      job_level_id: jobLevelIds.length ? jobLevelIds : undefined,
    }),
    [countryIds, departmentIds, jobLevelIds],
  );

  const activeFilterCount =
    countryIds.length + departmentIds.length + jobLevelIds.length;

  const clearAll = useCallback(
    () => setSearchParams({}, { replace: true }),
    [setSearchParams],
  );

  return {
    filters,
    countryIds,
    departmentIds,
    jobLevelIds,
    activeFilterCount,
    update,
    clearAll,
  };
}
