import { useMemo, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, UserCheck, UserMinus } from "lucide-react";

import DataTable from "../../../common/DataTable";
import Pagination from "../../../common/Pagination";
import ConfirmDialog from "../../../common/ConfirmDialog";
import EmployeeFilters from "./components/EmployeeFilters";
import EditEmployeeModal from "./components/EditEmployeeModal";
import { PAGE_SIZE, useEmployeeFilters } from "./hooks/useEmployeeFilters";
import {
  fetchEmployees,
  setEmployeeActive,
  type Employee,
} from "../../../api/employees";
import { fetchLookups } from "../../../api/lookups";
import { formatDate, formatMoney, formatUsd } from "../../../common/format";
import { useToast } from "../../../common/toast/useToast";

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
  const [changingStatus, setChangingStatus] = useState<Employee | null>(null);
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: (employee: Employee) =>
      setEmployeeActive(employee.id, !employee.is_active),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      showToast(
        `${updated.first_name} ${updated.last_name} is now ${
          updated.is_active ? "active" : "inactive"
        }.`,
      );
      setChangingStatus(null);
    },
    onError: (error: Error) => {
      showToast(error.message, "error");
      setChangingStatus(null);
    },
  });

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
          const label = employee.is_active ? "Deactivate" : "Reactivate";
          const Icon = employee.is_active ? UserMinus : UserCheck;
          return (
            <button
              type="button"
              title={`${label} employee`}
              aria-label={`${label} ${employee.first_name} ${employee.last_name}`}
              onClick={() => setChangingStatus(employee)}
              className={`rounded p-1.5 text-gray-400 transition ${
                employee.is_active
                  ? "hover:bg-red-50 hover:text-red-600"
                  : "hover:bg-green-50 hover:text-green-700"
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

      <EditEmployeeModal
        employee={editing}
        lookups={lookups}
        onClose={() => setEditing(null)}
      />

      <ConfirmDialog
        open={changingStatus !== null}
        onOpenChange={(open) => !open && setChangingStatus(null)}
        title={
          changingStatus?.is_active ? "Deactivate employee?" : "Reactivate employee?"
        }
        message={
          changingStatus?.is_active
            ? `${changingStatus.first_name} ${changingStatus.last_name} will be excluded from active headcount and pay reporting. Their record is kept, and you can reactivate them at any time.`
            : `${changingStatus?.first_name} ${changingStatus?.last_name} will be included in active headcount and pay reporting again.`
        }
        confirmLabel={changingStatus?.is_active ? "Deactivate" : "Reactivate"}
        isPending={statusMutation.isPending}
        onConfirm={() => changingStatus && statusMutation.mutate(changingStatus)}
      />
    </div>
  );
}
