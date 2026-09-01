import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, Plus, UserCheck, UserMinus } from "lucide-react";

import Button from "../../../common/Button";
import PageHeader from "../../../common/PageHeader";
import DataTable from "../../../common/DataTable";
import Pagination from "../../../common/Pagination";
import EmployeeFilters from "./components/EmployeeFilters";
import EmployeeFormModal from "./components/EmployeeFormModal";
import ExitDateDialog from "./components/ExitDateDialog";
import { PAGE_SIZE, useEmployeeFilters } from "./hooks/useEmployeeFilters";
import { fetchEmployees, type Employee } from "../../../api/employees";
import { fetchLookups } from "../../../api/lookups";
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatUsd,
} from "../../../common/format";

const columnHelper = createColumnHelper<Employee>();

const SORTABLE_COLUMNS = new Set(["first_name", "hire_date", "salary_usd"]);

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

  const [editing, setEditing] = useState<Employee | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [changingStatus, setChangingStatus] = useState<Employee | null>(null);

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
        id: "first_name",
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
            <div className="flex flex-col tabular-nums">
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
        cell: (info) => {
          const { is_active, is_leaving, exit_date } = info.row.original;

          // Three states, not two: someone serving notice is still active and
          // still paid, but HR needs to see the departure coming.
          if (is_leaving) {
            return (
              <span
                title={`Leaving on ${formatDate(exit_date!)}`}
                className="inline-flex whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
              >
                Leaving {formatDate(exit_date!)}
              </span>
            );
          }

          if (is_active) {
            return (
              <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                Active
              </span>
            );
          }

          return (
            <span
              title={exit_date ? `Left on ${formatDate(exit_date)}` : undefined}
              className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
            >
              Inactive
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "edit",
        header: "",
        cell: (info) => (
          <button
            type="button"
            title="Edit employee"
            aria-label={`Edit ${info.row.original.first_name} ${info.row.original.last_name}`}
            onClick={() => setEditing(info.row.original)}
            className="rounded p-1.5 text-gray-400 transition hover:bg-violet-50 hover:text-violet-700"
          >
            <Pencil size={16} />
          </button>
        ),
      }),
      columnHelper.display({
        id: "status_action",
        header: "",
        cell: (info) => {
          const employee = info.row.original;
          // A scheduled leaver is still active, but the useful action is to
          // cancel the departure rather than record another one.
          const isReinstating = !employee.is_active || employee.is_leaving;
          const label = isReinstating ? "Reinstate" : "Record departure for";
          const Icon = isReinstating ? UserCheck : UserMinus;

          return (
            <button
              type="button"
              title={isReinstating ? "Reinstate employee" : "Record departure"}
              aria-label={`${label} ${employee.first_name} ${employee.last_name}`}
              onClick={() => setChangingStatus(employee)}
              className={`rounded p-1.5 text-gray-400 transition ${
                isReinstating
                  ? "hover:bg-green-50 hover:text-green-700"
                  : "hover:bg-red-50 hover:text-red-600"
              }`}
            >
              <Icon size={16} />
            </button>
          );
        },
      }),
    ],
    [],
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Employees"
        subtitle={
          data
            ? `${formatNumber(data.total)} ${data.total === 1 ? "employee" : "employees"}`
            : undefined
        }
        actions={
          // Disabled until lookups arrive, since the form needs them to offer a
          // country, department and level to pick from.
          <Button onClick={() => setIsAdding(true)} disabled={!lookups}>
            <Plus size={16} />
            Add employee
          </Button>
        }
      />

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
              />
            )}
          </>
        )}
      </div>

      {/* Mounted only while open, so each opening starts from the right values
          without an effect to reset the form. */}
      {editing && (
        <EmployeeFormModal
          employee={editing}
          lookups={lookups}
          onClose={() => setEditing(null)}
        />
      )}

      {isAdding && (
        <EmployeeFormModal lookups={lookups} onClose={() => setIsAdding(false)} />
      )}

      <ExitDateDialog
        key={changingStatus?.id}
        employee={changingStatus}
        onClose={() => setChangingStatus(null)}
      />
    </div>
  );
}
