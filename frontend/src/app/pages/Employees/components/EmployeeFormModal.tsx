import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Button from "../../../../common/Button";
import Modal from "../../../../common/Modal";
import FormField, {
  errorInputClass,
  inputClass,
} from "../../../../common/FormField";
import { useToast } from "../../../../common/toast/useToast";
import {
  createEmployee,
  updateEmployee,
  type Employee,
  type EmployeeCreate,
  type EmployeeUpdate,
} from "../../../../api/employees";
import type { Lookups } from "../../../../api/lookups";
import { todayIso } from "../../../../common/format";

/** Creating and editing share every field, every validation rule, and the same
 *  country/currency coupling. They differ only in where the initial values come
 *  from and what is sent on submit, so they are one component rather than two
 *  copies of the same form that drift apart. */
type EmployeeFormModalProps = {
  /** Absent means create. */
  employee?: Employee;
  lookups: Lookups | undefined;
  onClose: () => void;
};

type FormState = {
  first_name: string;
  last_name: string;
  email: string;
  country_id: number;
  department_id: number;
  job_level_id: number;
  salary: string;
  hire_date: string;
  exit_date: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

function toFormState(employee: Employee): FormState {
  return {
    first_name: employee.first_name,
    last_name: employee.last_name,
    email: employee.email,
    country_id: employee.country.id,
    department_id: employee.department.id,
    job_level_id: employee.job_level.id,
    salary: employee.salary.amount,
    hire_date: employee.hire_date,
    // Empty string is the date input's "no value"; translated back to null on save.
    exit_date: employee.exit_date ?? "",
  };
}

function blankFormState(lookups: Lookups | undefined): FormState {
  return {
    first_name: "",
    last_name: "",
    email: "",
    country_id: lookups?.countries[0]?.id ?? 0,
    department_id: lookups?.departments[0]?.id ?? 0,
    job_level_id: lookups?.job_levels[0]?.id ?? 0,
    salary: "",
    hire_date: todayIso(),
    exit_date: "",
  };
}

/** Decimal places the currency actually has, so the form rejects ¥5000.55
 *  before the server has to. */
const MINOR_UNITS: Record<string, number> = { JPY: 0 };

function decimalPlaces(value: string): number {
  const [, decimals] = value.split(".");
  return decimals?.length ?? 0;
}

/** Spells out what the chosen date implies, since status is derived from it and
 *  a future date does not mean the person has left. */
function exitDateHint(exitDate: string): string {
  if (!exitDate) return "Leave empty while employed";

  return exitDate > todayIso()
    ? "Future date — stays active until then"
    : "Marks the employee as inactive";
}

export default function EmployeeFormModal({
  employee,
  lookups,
  onClose,
}: EmployeeFormModalProps) {
  const isEdit = employee !== undefined;

  // Mounted fresh per employee via a key in the parent, so the initial values
  // are correct without an effect to reset them.
  const [form, setForm] = useState<FormState>(() =>
    employee ? toFormState(employee) : blankFormState(lookups),
  );
  const [errors, setErrors] = useState<Errors>({});
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const selectedCountry = useMemo(
    () => lookups?.countries.find((country) => country.id === form.country_id),
    [lookups, form.country_id],
  );

  const currency =
    selectedCountry?.default_currency_code ?? employee?.salary.currency ?? "USD";

  // Only meaningful when editing: on create there is no previous country, so
  // picking one is not a relocation.
  const countryChanged = isEdit && form.country_id !== employee.country.id;

  const mutation = useMutation({
    mutationFn: (payload: EmployeeCreate | EmployeeUpdate) =>
      isEdit
        ? updateEmployee(employee.id, payload as EmployeeUpdate)
        : createEmployee(payload as EmployeeCreate),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      showToast(
        isEdit
          ? `Saved changes to ${saved.first_name} ${saved.last_name}.`
          : `${saved.first_name} ${saved.last_name} has been added.`,
      );
      onClose();
    },
    onError: (error: Error) => {
      // A duplicate email is the one failure the user can act on, so it is shown
      // against the field rather than in a toast they must remember.
      if (/email/i.test(error.message)) {
        setErrors((current) => ({ ...current, email: error.message }));
        return;
      }
      showToast(error.message, "error");
    },
  });

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleCountryChange = (countryId: number) => {
    setForm((current) => {
      if (!employee) return { ...current, country_id: countryId };

      // A country change means a currency change, so the existing figure no
      // longer means what it says. Cleared deliberately rather than converted:
      // relocation pay is renegotiated, not passed through an exchange rate.
      const isReverting = countryId === employee.country.id;
      return {
        ...current,
        country_id: countryId,
        salary: isReverting ? employee.salary.amount : "",
      };
    });
    setErrors((current) => ({ ...current, salary: undefined }));
  };

  const validate = (): Errors => {
    const next: Errors = {};

    if (!form.first_name.trim()) next.first_name = "Required";
    if (!form.last_name.trim()) next.last_name = "Required";
    if (!form.email.trim()) next.email = "Required";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) {
      next.email = "Enter a valid email address";
    }
    if (!form.hire_date) next.hire_date = "Required";
    if (form.exit_date && form.exit_date < form.hire_date) {
      next.exit_date = "Cannot be before the hire date";
    }

    const allowedDecimals = MINOR_UNITS[currency] ?? 2;
    const salary = form.salary.trim();
    if (!salary) {
      next.salary = countryChanged ? `Enter the new salary in ${currency}` : "Required";
    } else if (!/^\d+(\.\d+)?$/.test(salary)) {
      next.salary = "Enter a number, without symbols or separators";
    } else if (decimalPlaces(salary) > allowedDecimals) {
      next.salary =
        allowedDecimals === 0
          ? `${currency} has no decimal places`
          : `${currency} supports at most ${allowedDecimals} decimal places`;
    }

    return next;
  };

  const buildChanges = (): EmployeeUpdate => {
    const original = toFormState(employee!);
    const changes: EmployeeUpdate = {};

    (Object.keys(original) as (keyof FormState)[]).forEach((key) => {
      const value = typeof form[key] === "string" ? form[key].trim() : form[key];
      if (value !== original[key]) {
        // Only what actually changed, so a PATCH never clobbers a field the
        // user did not touch. An emptied exit date must go as an explicit null,
        // since "" would not clear it.
        Object.assign(changes, {
          [key]: key === "exit_date" && value === "" ? null : value,
        });
      }
    });

    // The API requires the pair together; salary may be unchanged in value but
    // it now means a different currency.
    if (changes.country_id !== undefined && changes.salary === undefined) {
      changes.salary = form.salary.trim();
    }

    return changes;
  };

  const buildNewEmployee = (): EmployeeCreate => ({
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    email: form.email.trim(),
    country_id: form.country_id,
    department_id: form.department_id,
    job_level_id: form.job_level_id,
    salary: form.salary.trim(),
    hire_date: form.hire_date,
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    if (!isEdit) {
      mutation.mutate(buildNewEmployee());
      return;
    }

    const changes = buildChanges();
    if (Object.keys(changes).length === 0) {
      showToast("No changes to save.");
      onClose();
      return;
    }

    mutation.mutate(changes);
  };

  const field = (key: keyof FormState) => (errors[key] ? errorInputClass : inputClass);

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={isEdit ? "Edit employee" : "Add employee"}
      description={
        isEdit
          ? `${employee.first_name} ${employee.last_name} · ${employee.email}`
          : "Pay currency is set by the country and cannot be chosen separately."
      }
      widthClassName="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" disabled={mutation.isPending}>
            {mutation.isPending
              ? isEdit
                ? "Saving…"
                : "Adding…"
              : isEdit
                ? "Save changes"
                : "Add employee"}
          </Button>
        </>
      }
    >
      <form
        id="employee-form"
        onSubmit={handleSubmit}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <FormField label="First name" htmlFor="first_name" error={errors.first_name}>
          <input
            id="first_name"
            value={form.first_name}
            onChange={(e) => setField("first_name", e.target.value)}
            className={field("first_name")}
          />
        </FormField>

        <FormField label="Last name" htmlFor="last_name" error={errors.last_name}>
          <input
            id="last_name"
            value={form.last_name}
            onChange={(e) => setField("last_name", e.target.value)}
            className={field("last_name")}
          />
        </FormField>

        <div className="sm:col-span-2">
          <FormField label="Email" htmlFor="email" error={errors.email}>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              className={field("email")}
            />
          </FormField>
        </div>

        <FormField label="Country" htmlFor="country_id" hint={`Paid in ${currency}`}>
          <select
            id="country_id"
            value={form.country_id}
            onChange={(e) => handleCountryChange(Number(e.target.value))}
            className={inputClass}
          >
            {lookups?.countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name} ({country.default_currency_code})
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label={`Salary (${currency})`}
          htmlFor="salary"
          error={errors.salary}
          hint={
            countryChanged
              ? `Country changed — enter the new salary in ${currency}`
              : undefined
          }
        >
          <input
            id="salary"
            inputMode="decimal"
            value={form.salary}
            placeholder={countryChanged ? `Amount in ${currency}` : undefined}
            onChange={(e) => setField("salary", e.target.value)}
            className={
              countryChanged && !form.salary && !errors.salary
                ? `${inputClass} border-amber-400`
                : field("salary")
            }
          />
        </FormField>

        <FormField label="Department" htmlFor="department_id">
          <select
            id="department_id"
            value={form.department_id}
            onChange={(e) => setField("department_id", Number(e.target.value))}
            className={inputClass}
          >
            {lookups?.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Job level" htmlFor="job_level_id">
          <select
            id="job_level_id"
            value={form.job_level_id}
            onChange={(e) => setField("job_level_id", Number(e.target.value))}
            className={inputClass}
          >
            {lookups?.job_levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.title}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Hire date" htmlFor="hire_date" error={errors.hire_date}>
          <input
            id="hire_date"
            type="date"
            value={form.hire_date}
            onChange={(e) => setField("hire_date", e.target.value)}
            className={field("hire_date")}
          />
        </FormField>

        {/* New hires are active by definition, and the create endpoint takes no
            exit date, so the field only exists when editing. */}
        {isEdit && (
          <FormField
            label="Exit date"
            htmlFor="exit_date"
            error={errors.exit_date}
            hint={exitDateHint(form.exit_date)}
          >
            <input
              id="exit_date"
              type="date"
              value={form.exit_date}
              min={form.hire_date}
              onChange={(e) => setField("exit_date", e.target.value)}
              className={field("exit_date")}
            />
          </FormField>
        )}
      </form>
    </Modal>
  );
}
