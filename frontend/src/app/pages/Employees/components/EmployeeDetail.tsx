import { useQuery } from "@tanstack/react-query";
import { Pencil, UserCheck, UserMinus } from "lucide-react";
import type { ReactNode } from "react";

import Button from "../../../../common/Button";
import Drawer from "../../../../common/Drawer";
import StatusBadge from "./StatusBadge";
import { fetchEmployee, type Employee } from "../../../../api/employees";
import { formatDate, formatMoney, formatUsd } from "../../../../common/format";

type EmployeeDetailProps = {
  /** The row that was clicked. Shown immediately while the record is refetched. */
  employee: Employee;
  onClose: () => void;
  onEdit: (employee: Employee) => void;
  onChangeStatus: (employee: Employee) => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}

export default function EmployeeDetail({
  employee,
  onClose,
  onEdit,
  onChangeStatus,
}: EmployeeDetailProps) {
  // The clicked row already holds everything shown here, so it seeds the cache
  // and the panel opens populated rather than flashing a spinner. The refetch
  // still runs, which is what picks up an edit made since the page was loaded.
  const { data } = useQuery({
    queryKey: ["employee", employee.id],
    queryFn: () => fetchEmployee(employee.id),
    initialData: employee,
  });

  const isReinstating = !data.is_active || data.is_leaving;

  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${data.first_name} ${data.last_name}`}
      description={data.email}
      footer={
        <>
          <Button variant="ghost" onClick={() => onChangeStatus(data)}>
            {isReinstating ? <UserCheck size={16} /> : <UserMinus size={16} />}
            {isReinstating ? "Reinstate" : "Record departure"}
          </Button>
          <Button onClick={() => onEdit(data)}>
            <Pencil size={16} />
            Edit
          </Button>
        </>
      }
    >
      <dl className="divide-y divide-gray-100">
        <Field label="Status">
          <StatusBadge employee={data} />
        </Field>

        <Field label="Country">{data.country.name}</Field>
        <Field label="Department">{data.department.name}</Field>
        <Field label="Job level">{data.job_level.title}</Field>

        <Field label="Salary">
          <div className="flex flex-col items-end">
            <span className="tabular-nums">
              {formatMoney(data.salary.amount, data.salary.currency)}
            </span>
            {/* Local pay is what the person receives; the USD figure is what makes
                them comparable to anyone else. */}
            {data.salary.currency !== "USD" && (
              <span className="text-xs font-normal text-gray-500">
                {formatUsd(data.salary.amount_usd)}
              </span>
            )}
          </div>
        </Field>

        <Field label="Hire date">{formatDate(data.hire_date)}</Field>

        <Field label="Exit date">
          {data.exit_date ? (
            formatDate(data.exit_date)
          ) : (
            <span className="font-normal text-gray-400">—</span>
          )}
        </Field>
      </dl>
    </Drawer>
  );
}
