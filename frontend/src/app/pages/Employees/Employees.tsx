import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";

import DataTable from "../../../common/DataTable";
import Pagination from "../../../common/Pagination";
import EmployeeFilters from "./components/EmployeeFilters";
import { PAGE_SIZE, useEmployeeFilters } from "./hooks/useEmployeeFilters";
import { fetchEmployees, type Employee } from "../../../api/employees";
import { fetchLookups } from "../../../api/lookups";
import { formatDate, formatMoney, formatUsd } from "../../../common/format";

const columnHelper = createColumnHelper<Employee>();

const SORTABLE_COLUMNS = new Set(["last_name", "hire_date", "salary_usd"]);

export default function Employees() {
  const {
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
  } = useEmployeeFilters();

  const { data: lookups } = useQuery({
    queryKey: ["lookups"],
    queryFn: fetchLookups,
    // Reference data changes about never, so refetching it is wasted work.
    staleTime: Infinity,
  });

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["employees", filters],
    queryFn: () => fetchEmployees(filters),
    // Keeps the previous page on screen while the next loads, so the table does
    // not collapse to skeletons on every filter keystroke.
    placeholderData: keepPreviousData,
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor((row) => `${row.first_name} ${row.last_name}`, {
        id: "last_name",
        header: "Name",
        cell: (info) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900">{info.getValue()}</span>
            <span className="text-xs text-gray-500">{info.row.original.email}</span>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.country.name, {
        id: "country",
        header: "Country",
      }),
      columnHelper.accessor((row) => row.department.name, {
        id: "department",
        header: "Department",
      }),
      columnHelper.accessor((row) => row.job_level.title, {
        id: "job_level",
        header: "Level",
      }),
      columnHelper.accessor((row) => row.salary.amount, {
        id: "salary_usd",
        header: "Salary",
        cell: (info) => {
          const { salary } = info.row.original;
          const isBaseCurrency = salary.currency === "USD";
          return (
            <div className="flex flex-col text-right tabular-nums">
              <span className="font-medium text-gray-900">
                {formatMoney(salary.amount, salary.currency)}
              </span>
              {/* Local currency is what the person is paid; USD is what makes
                  rows comparable. Showing both avoids a misleading comparison. */}
              {!isBaseCurrency && (
                <span className="text-xs text-gray-500">
                  {formatUsd(salary.amount_usd)}
                </span>
              )}
            </div>
          );
        },
      }),
      columnHelper.accessor("hire_date", {
        id: "hire_date",
        header: "Hire date",
        cell: (info) => (
          <span className="whitespace-nowrap">{formatDate(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("is_active", {
        id: "is_active",
        header: "Status",
        cell: (info) =>
          info.getValue() ? (
            <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              Active
            </span>
          ) : (
            <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              Inactive
            </span>
          ),
      }),
    ],
    [],
  );

  return (
    <div className="flex flex-col">
      <EmployeeFilters
        lookups={lookups}
        q={q}
        status={status}
        countryIds={countryIds}
        departmentIds={departmentIds}
        jobLevelIds={jobLevelIds}
        activeFilterCount={activeFilterCount}
        onChange={update}
        onClear={clearAll}
      />

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        {isError ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-gray-900">Could not load employees.</p>
            <p className="mt-1 text-sm text-gray-500">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        ) : (
          <>
            <div
              className={`transition-opacity ${isFetching && !isLoading ? "opacity-60" : ""}`}
            >
              <DataTable
                data={data?.items}
                columns={columns}
                isLoading={isLoading}
                sortableColumns={SORTABLE_COLUMNS}
                sortBy={sortBy}
                sortOrder={sortDir}
                onSort={toggleSort}
                skeletonRows={PAGE_SIZE}
                emptyMessage="No employees match these filters"
              />
            </div>

            {!isLoading && (
              <Pagination
                page={page}
                limit={PAGE_SIZE}
                total={data?.total ?? 0}
                totalPages={data?.total_pages ?? 0}
                itemLabel="employees"
                onPageChange={(nextPage) => update({ page: nextPage }, false)}
                className="mt-2"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
