import type { Employee } from "../../../../api/employees";
import { formatDate } from "../../../../common/format";

/** Three states, not two: someone serving notice is still active and still paid,
 *  but HR needs to see the departure coming.
 *
 *  Shared by the table and the detail panel so the same record cannot be
 *  labelled differently in two places. */
export default function StatusBadge({ employee }: { employee: Employee }) {
  const { is_active, is_leaving, exit_date } = employee;

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
}
