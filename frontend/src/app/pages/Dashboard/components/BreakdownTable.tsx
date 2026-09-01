import type { Breakdown } from "../../../../api/analytics";
import { formatNumber, formatUsd } from "../../../../common/format";

type BreakdownTableProps = {
  title: string;
  groupLabel: string;
  rows: Breakdown[] | undefined;
  isLoading?: boolean;
};

export default function BreakdownTable({
  title,
  groupLabel,
  rows,
  isLoading,
}: BreakdownTableProps) {
  // Bars are scaled to the largest group rather than to total spend: the point is
  // to compare groups with each other, and against the total every bar would be a
  // sliver.
  const maxSpend = Math.max(1, ...(rows ?? []).map((r) => Number(r.total_spend_usd)));

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-2 text-left font-medium">{groupLabel}</th>
              <th className="px-4 py-2 text-right font-medium">Headcount</th>
              <th className="px-4 py-2 text-right font-medium">Avg salary</th>
              <th className="px-4 py-2 text-right font-medium">Total spend</th>
            </tr>
          </thead>

          <tbody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={index} className="border-t border-gray-100">
                  <td className="px-4 py-3" colSpan={4}>
                    <div className="h-4 animate-pulse rounded bg-gray-100" />
                  </td>
                </tr>
              ))}

            {!isLoading && rows?.length === 0 && (
              <tr className="border-t border-gray-100">
                <td className="px-4 py-8 text-center text-gray-500" colSpan={4}>
                  No employees match these filters
                </td>
              </tr>
            )}

            {!isLoading &&
              rows?.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900">
                    {row.name}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {formatNumber(row.headcount)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                    {formatUsd(row.average_salary_usd)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums font-medium text-gray-900">
                      {formatUsd(row.total_spend_usd)}
                    </span>
                    {/* The bar carries the ranking; the number carries the value.
                        Reading it off the figures alone means comparing nine-digit
                        strings. */}
                    <span className="mt-1 flex h-1 w-full justify-end overflow-hidden rounded-full bg-gray-100">
                      <span
                        className="h-full rounded-full bg-violet-500"
                        style={{
                          width: `${(Number(row.total_spend_usd) / maxSpend) * 100}%`,
                        }}
                      />
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
