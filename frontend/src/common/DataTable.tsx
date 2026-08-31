import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { ChevronsUpDown, MoveDown, MoveUp } from "lucide-react";

export type SortOrder = "asc" | "desc" | "";

type DataTableProps<TData> = {
  data: TData[] | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<TData, any>[];
  isLoading: boolean;
  sortableColumns?: Set<string>;
  sortBy?: string;
  sortOrder?: SortOrder;
  onSort?: (field: string) => void;
  onRowClick?: (row: TData) => void;
  skeletonRows?: number;
  emptyMessage?: string;
};

const SHIMMER_BAR =
  "h-4 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] animate-shimmer";

function TableSkeleton({ columnCount, rows }: { columnCount: number; rows: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            {Array.from({ length: columnCount }).map((_, colIndex) => (
              <th key={colIndex} className="px-4 py-3 text-left">
                <div className={`${SHIMMER_BAR} w-20`} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-gray-100">
              {Array.from({ length: columnCount }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  <div className={SHIMMER_BAR} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Stable reference so react-table doesn't re-init while data is loading.
const EMPTY_DATA: unknown[] = [];

function DataTable<TData>({
  data,
  columns,
  isLoading,
  sortableColumns,
  sortBy,
  sortOrder = "",
  onSort,
  onRowClick,
  skeletonRows = 15,
  emptyMessage = "No results",
}: DataTableProps<TData>) {
  const tableData = useMemo(() => data ?? (EMPTY_DATA as TData[]), [data]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <TableSkeleton columnCount={columns.length} rows={skeletonRows} />;
  }

  const SortIcon = sortOrder === "asc" ? MoveUp : MoveDown;
  const rows = table.getRowModel().rows;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-gray-200">
              {headerGroup.headers.map((header) => {
                const headerContent = flexRender(
                  header.column.columnDef.header,
                  header.getContext(),
                );
                const isSortable = !!onSort && !!sortableColumns?.has(header.column.id);
                const isActiveSort = sortBy === header.column.id && sortOrder.length > 0;

                return (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-4 py-3 text-left font-medium text-gray-600"
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => onSort(header.column.id)}
                        className="flex items-center gap-1 hover:text-gray-900"
                      >
                        {headerContent}
                        {isActiveSort ? (
                          <SortIcon size={14} />
                        ) : (
                          <ChevronsUpDown size={14} className="text-gray-400" />
                        )}
                      </button>
                    ) : (
                      headerContent
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick?.(row.original)}
                className={`border-b border-gray-100 hover:bg-gray-50 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-gray-700">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
