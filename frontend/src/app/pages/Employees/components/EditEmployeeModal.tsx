import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Button from "../../../../common/Button";
import Modal from "../../../../common/Modal";
import FormField, {
  errorInputClass,
  inputClass,
} from "../../../../common/FormField";
import { useToast } from "../../../../common/toast/useToast";
import {
  updateEmployee,
  type Employee,
  type EmployeeUpdate,
} from "../../../../api/employees";
import type { Lookups } from "../../../../api/lookups";

type EditEmployeeModalProps = {
  employee: Employee | null;
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
  };
}

/** Decimal places the currency actually has, so the form rejects ¥5000.55
 *  before the server has to. */
const MINOR_UNITS: Record<string, number> = { JPY: 0 };

function decimalPlaces(value: string): number {
  const [, decimals] = value.split(".");
  return decimals?.length ?? 0;
}

export default function EditEmployeeModal({
  employee,
  lookups,
  onClose,
}: EditEmployeeModalProps) {
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setForm(employee ? toFormState(employee) : null);
    setErrors({});
  }, [employee]);

  const selectedCountry = useMemo(
    () => lookups?.countries.find((country) => country.id === form?.country_id),
    [lookups, form?.country_id],
  );

  const currency = selectedCountry?.default_currency_code ?? employee?.salary.currency ?? "USD";
  const countryChanged = !!employee && !!form && form.country_id !== employee.country.id;

  const mutation = useMutation({
    mutationFn: (changes: EmployeeUpdate) => updateEmployee(employee!.id, changes),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      showToast(`Saved changes to ${updated.first_name} ${updated.last_name}.`);
      onClose();
    },
    onError: (error: Error) => showToast(error.message, "error"),
  });

  if (!employee || !form) return null;

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleCountryChange = (countryId: number) => {
    setForm((current) => {
      if (!current) return current;
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

    const salary = form.salary.trim();
    if (!salary) {
      next.salary = countryChanged
        ? `Enter the new salary in ${currency}`
        : "Required";
    } else if (!/^\d+(\.\d+)?$/.test(salary)) {
      next.salary = "Enter a number, without symbols or separators";
    } else if (decimalPlaces(salary) > (MINOR_UNITS[currency] ?? 2)) {
      next.salary =
        (MINOR_UNITS[currency] ?? 2) === 0
          ? `${currency} has no decimal places`
          : `${currency} supports at most ${MINOR_UNITS[currency] ?? 2} decimal places`;
    }

    return next;
  };

  const buildChanges = (): EmployeeUpdate => {
    const original = toFormState(employee);
    const changes: EmployeeUpdate = {};

    (Object.keys(original) as (keyof FormState)[]).forEach((key) => {
      const value = typeof form[key] === "string" ? form[key].trim() : form[key];
      if (value !== original[key]) {
        // Only what actually changed, so a PATCH never clobbers a field the
        // user did not touch.
        Object.assign(changes, { [key]: value });
      }
    });

    // The API requires the pair together; salary may be unchanged in value but
    // it now means a different currency.
    if (changes.country_id !== undefined && changes.salary === undefined) {
      changes.salary = form.salary.trim();
    }

    return changes;
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
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
      title="Edit employee"
      description={`${employee.first_name} ${employee.last_name} · ${employee.email}`}
      widthClassName="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-employee-form"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <form
        id="edit-employee-form"
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

        <FormField
          label="Country"
          htmlFor="country_id"
          hint={`Paid in ${currency}`}
        >
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
      </form>
    </Modal>
  );
}
