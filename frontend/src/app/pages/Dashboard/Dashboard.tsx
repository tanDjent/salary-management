import { keepPreviousData, useQuery } from "@tanstack/react-query";

import PageHeader from "../../../common/PageHeader";
import KpiCard from "./components/KpiCard";
import BreakdownTable from "./components/BreakdownTable";
import AnalyticsFilters from "./components/AnalyticsFilters";
import { useAnalyticsFilters } from "./hooks/useAnalyticsFilters";
import { fetchAnalytics } from "../../../api/analytics";
import { fetchLookups } from "../../../api/lookups";
import {
  formatNumber,
  formatUsd,
  formatUsdCompact,
} from "../../../common/format";

export default function Dashboard() {
  const {
    filters,
    countryIds,
    departmentIds,
    jobLevelIds,
    activeFilterCount,
    update,
    clearAll,
  } = useAnalyticsFilters();

  const { data: lookups } = useQuery({
    queryKey: ["lookups"],
    queryFn: fetchLookups,
    staleTime: Infinity,
  });

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["analytics", filters],
    queryFn: () => fetchAnalytics(filters),
    // Keeps the previous figures on screen while the next load runs, so changing
    // a filter does not blank the whole dashboard.
    placeholderData: keepPreviousData,
  });

  const totals = data?.totals;

  /** Link to the same population in the directory. The dashboard's filters are
   *  carried over, so clicking a card that reads 16 shows those 16 rather than
   *  quietly widening to the whole org. */
  const directoryLink = (status: string) => {
    const params = new URLSearchParams({ status });
    countryIds.forEach((id) => params.append("country_id", String(id)));
    departmentIds.forEach((id) => params.append("department_id", String(id)));
    jobLevelIds.forEach((id) => params.append("job_level_id", String(id)));
    return `/employees?${params}`;
  };

  if (isError) {
    return (
      <div className="flex flex-col">
        <PageHeader title="Dashboard" />
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-12 text-center">
          <p className="text-sm text-gray-900">Could not load pay analytics.</p>
          <p className="mt-1 text-sm text-gray-500">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Dashboard"
        subtitle="Pay across the organisation, normalised to USD. Active employees only."
      />

      <AnalyticsFilters
        lookups={lookups}
        countryIds={countryIds}
        departmentIds={departmentIds}
        jobLevelIds={jobLevelIds}
        activeFilterCount={activeFilterCount}
        onChange={update}
        onClear={clearAll}
      />

      <div
        className={`flex flex-col gap-4 transition-opacity ${
          isFetching && !isLoading ? "opacity-60" : ""
        }`}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label="Annual payroll"
            value={totals ? formatUsdCompact(totals.total_spend_usd) : null}
            title={totals ? formatUsd(totals.total_spend_usd) : undefined}
            hint="Total base salary"
            isLoading={isLoading}
          />
          <KpiCard
            label="Headcount"
            value={totals ? formatNumber(totals.headcount) : null}
            hint="Currently employed"
            to={directoryLink("active")}
            isLoading={isLoading}
          />
          <KpiCard
            label="Average salary"
            value={
              totals?.average_salary_usd
                ? formatUsd(totals.average_salary_usd)
                : null
            }
            hint="Mean, pulled up by top earners"
            isLoading={isLoading}
          />
          <KpiCard
            label="Median salary"
            value={
              totals?.median_salary_usd ? formatUsd(totals.median_salary_usd) : null
            }
            hint="What a typical employee earns"
            isLoading={isLoading}
          />
          <KpiCard
            label="Leaving soon"
            value={totals ? formatNumber(totals.leaving_soon) : null}
            hint="Departures already scheduled"
            to={directoryLink("leaving")}
            isLoading={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <BreakdownTable
            title="By country"
            groupLabel="Country"
            rows={data?.by_country}
            isLoading={isLoading}
          />
          <BreakdownTable
            title="By department"
            groupLabel="Department"
            rows={data?.by_department}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
