import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Button from "../../../../common/Button";
import Modal from "../../../../common/Modal";
import FormField, {
  errorInputClass,
  inputClass,
} from "../../../../common/FormField";
import { useToast } from "../../../../common/toast/useToast";
import {
  deactivateEmployee,
  reactivateEmployee,
  type Employee,
} from "../../../../api/employees";
import { formatDate } from "../../../../common/format";

type ExitDateDialogProps = {
  employee: Employee | null;
  onClose: () => void;
};

function todayIso(): string {
  // Local calendar date, not UTC: toISOString() would show yesterday for anyone
  // west of Greenwich late in the day.
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function ExitDateDialog({ employee, onClose }: ExitDateDialogProps) {
  // Mounted fresh per employee via a key in the parent, so the initial value is
  // correct without an effect to reset it.
  const [exitDate, setExitDate] = useState(employee?.exit_date ?? todayIso());
  const [error, setError] = useState<string>();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const isReinstating = employee ? !employee.is_active || employee.is_leaving : false;

  const mutation = useMutation({
    mutationFn: () =>
      isReinstating
        ? reactivateEmployee(employee!.id)
        : deactivateEmployee(employee!.id, exitDate),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      showToast(summarise(updated));
      onClose();
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message);
    },
  });

  if (!employee) return null;

  const name = `${employee.first_name} ${employee.last_name}`;

  const handleConfirm = () => {
    if (!isReinstating) {
      if (!exitDate) {
        setError("Choose an exit date");
        return;
      }
      if (exitDate < employee.hire_date) {
        setError(`Cannot be before the hire date, ${formatDate(employee.hire_date)}`);
        return;
      }
    }
    mutation.mutate();
  };

  const isFutureDate = exitDate > todayIso();

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={isReinstating ? "Reinstate employee?" : "Record a departure"}
      widthClassName="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={mutation.isPending}>
            {mutation.isPending
              ? "Working…"
              : isReinstating
                ? "Reinstate"
                : "Confirm departure"}
          </Button>
        </>
      }
    >
      {isReinstating ? (
        <p className="text-sm text-gray-600">
          {employee.is_leaving
            ? `${name} is scheduled to leave on ${formatDate(employee.exit_date!)}. Reinstating cancels that departure and clears the exit date.`
            : `${name} left on ${formatDate(employee.exit_date!)}. Reinstating clears the exit date and returns them to active headcount and pay reporting.`}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            {name}&rsquo;s record is kept — only their status changes, and it can be
            reversed at any time.
          </p>

          <FormField
            label="Exit date"
            htmlFor="exit_date"
            error={error}
            hint={
              isFutureDate
                ? "Future date: they stay active and counted in payroll until then."
                : "They will be excluded from active headcount and pay reporting."
            }
          >
            <input
              id="exit_date"
              type="date"
              value={exitDate}
              min={employee.hire_date}
              onChange={(event) => {
                setExitDate(event.target.value);
                setError(undefined);
              }}
              className={error ? errorInputClass : inputClass}
            />
          </FormField>
        </div>
      )}

      {error && isReinstating && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </Modal>
  );
}

function summarise(employee: Employee): string {
  const name = `${employee.first_name} ${employee.last_name}`;

  if (employee.exit_date === null) return `${name} has been reinstated.`;
  if (employee.is_leaving) {
    return `${name} is scheduled to leave on ${formatDate(employee.exit_date)}.`;
  }
  return `${name} is recorded as having left on ${formatDate(employee.exit_date)}.`;
}
