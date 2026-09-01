import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Employee } from "../../../../api/employees";
import type { Lookups } from "../../../../api/lookups";
import ToastProvider from "../../../../common/toast/ToastProvider";
import EmployeeFormModal from "./EmployeeFormModal";

// The network is the boundary under test: these assert what the form decides to
// send, which is where the country/currency coupling either holds or does not.
vi.mock("../../../../api/employees", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
}));

const { createEmployee, updateEmployee } = await import("../../../../api/employees");

const lookups: Lookups = {
  countries: [
    { id: 1, name: "United States", iso_code: "US", default_currency_code: "USD" },
    { id: 2, name: "India", iso_code: "IN", default_currency_code: "INR" },
    { id: 3, name: "Japan", iso_code: "JP", default_currency_code: "JPY" },
  ],
  departments: [
    { id: 1, name: "Engineering" },
    { id: 2, name: "Sales" },
  ],
  job_levels: [
    { id: 1, title: "Associate", rank: 1 },
    { id: 3, title: "Senior", rank: 3 },
  ],
};

const existing: Employee = {
  id: 42,
  first_name: "Priya",
  last_name: "Raman",
  email: "priya.raman@acme.example",
  country: { id: 1, name: "United States" },
  department: { id: 1, name: "Engineering" },
  job_level: { id: 3, title: "Senior", rank: 3 },
  salary: { amount: "150000.00", currency: "USD", amount_usd: "150000.00" },
  hire_date: "2020-06-01",
  exit_date: null,
  is_active: true,
  is_leaving: false,
} as Employee;

function renderForm(props: Partial<React.ComponentProps<typeof EmployeeFormModal>> = {}) {
  const onClose = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <EmployeeFormModal lookups={lookups} onClose={onClose} {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  );

  return { onClose, user: userEvent.setup() };
}

const salaryField = () => screen.getByLabelText(/^Salary/);
const save = () => screen.getByRole("button", { name: /Save changes|Add employee/ });

beforeEach(() => vi.clearAllMocks());

describe("editing: only what changed is sent", () => {
  it("sends just the edited field, so a PATCH cannot clobber the rest", async () => {
    const { user } = renderForm({ employee: existing });

    await user.clear(screen.getByLabelText("Last name"));
    await user.type(screen.getByLabelText("Last name"), "Sharma");
    await user.click(save());

    await waitFor(() => expect(updateEmployee).toHaveBeenCalledWith(42, { last_name: "Sharma" }));
  });

  it("saves nothing when nothing was touched", async () => {
    const { user, onClose } = renderForm({ employee: existing });

    await user.click(save());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(updateEmployee).not.toHaveBeenCalled();
  });

  it("clears an exit date with an explicit null, since an empty string would not", async () => {
    const leaver = { ...existing, exit_date: "2026-11-30", is_leaving: true };
    const { user } = renderForm({ employee: leaver });

    await user.clear(screen.getByLabelText("Exit date"));
    await user.click(save());

    await waitFor(() => expect(updateEmployee).toHaveBeenCalledWith(42, { exit_date: null }));
  });
});

describe("changing country changes the currency", () => {
  it("clears the salary rather than carrying a figure that now means something else", async () => {
    // $150,000 becoming ₹150,000 would be a 98% pay cut applied silently.
    const { user } = renderForm({ employee: existing });

    expect(salaryField()).toHaveValue("150000.00");
    await user.selectOptions(screen.getByLabelText("Country"), "2");

    expect(salaryField()).toHaveValue("");
    expect(screen.getByText(/enter the new salary in INR/i)).toBeInTheDocument();
  });

  it("restores the original figure if the country is put back", async () => {
    // Reverting is a correction, not a relocation, so it should not cost the
    // user the number they never meant to clear.
    const { user } = renderForm({ employee: existing });

    await user.selectOptions(screen.getByLabelText("Country"), "2");
    await user.selectOptions(screen.getByLabelText("Country"), "1");

    expect(salaryField()).toHaveValue("150000.00");
  });

  it("refuses to save a relocation with no new salary", async () => {
    const { user } = renderForm({ employee: existing });

    await user.selectOptions(screen.getByLabelText("Country"), "2");
    await user.click(save());

    expect(await screen.findByText("Enter the new salary in INR")).toBeInTheDocument();
    expect(updateEmployee).not.toHaveBeenCalled();
  });

  it("sends country and salary together, even when the digits are unchanged", async () => {
    // The API needs the pair: the same number denominated differently is a
    // different salary, and sending the country alone would misstate the pay.
    const { user } = renderForm({ employee: existing });

    await user.selectOptions(screen.getByLabelText("Country"), "2");
    await user.type(salaryField(), "150000.00");
    await user.click(save());

    await waitFor(() =>
      expect(updateEmployee).toHaveBeenCalledWith(42, {
        country_id: 2,
        salary: "150000.00",
      }),
    );
  });

  it("relabels the field so the user knows which currency they are typing in", async () => {
    const { user } = renderForm({ employee: existing });

    expect(screen.getByLabelText("Salary (USD)")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Country"), "3");
    expect(screen.getByLabelText("Salary (JPY)")).toBeInTheDocument();
  });
});

describe("validation happens before the request", () => {
  it("rejects decimals on a currency that has none", async () => {
    // JPY has a minor unit of 0. Catching it here saves a round trip to a 422.
    const { user } = renderForm({ employee: existing });

    await user.selectOptions(screen.getByLabelText("Country"), "3");
    await user.type(salaryField(), "9000000.55");
    await user.click(save());

    expect(await screen.findByText("JPY has no decimal places")).toBeInTheDocument();
    expect(updateEmployee).not.toHaveBeenCalled();
  });

  it("accepts a whole amount in that same currency", async () => {
    const { user } = renderForm({ employee: existing });

    await user.selectOptions(screen.getByLabelText("Country"), "3");
    await user.type(salaryField(), "9000000");
    await user.click(save());

    await waitFor(() =>
      expect(updateEmployee).toHaveBeenCalledWith(42, { country_id: 3, salary: "9000000" }),
    );
  });

  it("rejects a salary typed with separators or a symbol", async () => {
    const { user } = renderForm({ employee: existing });

    await user.clear(salaryField());
    await user.type(salaryField(), "$150,000");
    await user.click(save());

    expect(
      await screen.findByText("Enter a number, without symbols or separators"),
    ).toBeInTheDocument();
    expect(updateEmployee).not.toHaveBeenCalled();
  });

  // The next two are guarded twice over: the input's own constraint stops the
  // submit, and the validate() rule behind it would catch the same thing if the
  // attribute were ever dropped. Only the outcome is asserted, since which of
  // the two fired is an implementation detail — what matters is that nothing
  // invalid reaches the API.
  it("does not submit an exit date that precedes the hire date", async () => {
    const { user } = renderForm({ employee: existing });

    // The floor is the employee's own hire date, not a fixed one.
    expect(screen.getByLabelText("Exit date")).toHaveAttribute("min", existing.hire_date);

    await user.type(screen.getByLabelText("Exit date"), "2019-01-01");
    await user.click(save());

    await waitFor(() => expect(updateEmployee).not.toHaveBeenCalled());
  });

  it("does not submit a malformed email", async () => {
    const { user } = renderForm({ employee: existing });

    await user.clear(screen.getByLabelText("Email"));
    await user.type(screen.getByLabelText("Email"), "priya.at.acme");
    await user.click(save());

    await waitFor(() => expect(updateEmployee).not.toHaveBeenCalled());
  });

  it("asks for an email when the field is emptied", async () => {
    // Nothing native fires here: the field is not marked required, so this is
    // the form's own rule doing the work.
    const { user } = renderForm({ employee: existing });

    await user.clear(screen.getByLabelText("Email"));
    await user.click(save());

    expect(await screen.findByText("Required")).toBeInTheDocument();
    expect(updateEmployee).not.toHaveBeenCalled();
  });
});

describe("creating", () => {
  it("has no exit date field, since a new hire is active by definition", () => {
    renderForm();

    expect(screen.queryByLabelText("Exit date")).not.toBeInTheDocument();
  });

  it("posts the whole record rather than a diff", async () => {
    const { user } = renderForm();

    await user.type(screen.getByLabelText("First name"), "Arun");
    await user.type(screen.getByLabelText("Last name"), "Nair");
    await user.type(screen.getByLabelText("Email"), "arun.nair@acme.example");
    await user.type(salaryField(), "120000");
    await user.click(save());

    await waitFor(() =>
      expect(createEmployee).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: "Arun",
          last_name: "Nair",
          email: "arun.nair@acme.example",
          salary: "120000",
          country_id: 1,
        }),
      ),
    );
  });

  it("does not treat picking a country as a relocation", async () => {
    // There is no previous country on create, so choosing one must not clear a
    // salary the user has already typed.
    const { user } = renderForm();

    await user.type(salaryField(), "120000");
    await user.selectOptions(screen.getByLabelText("Country"), "2");

    expect(salaryField()).toHaveValue("120000");
  });
});

describe("server errors", () => {
  it("shows a duplicate email against the field, not in a toast to be remembered", async () => {
    vi.mocked(createEmployee).mockRejectedValueOnce(
      new Error("An employee with this email already exists"),
    );
    const { user } = renderForm();

    await user.type(screen.getByLabelText("First name"), "Arun");
    await user.type(screen.getByLabelText("Last name"), "Nair");
    await user.type(screen.getByLabelText("Email"), "priya.raman@acme.example");
    await user.type(salaryField(), "120000");
    await user.click(save());

    expect(
      await screen.findByText("An employee with this email already exists"),
    ).toBeInTheDocument();
  });

  it("keeps the form open when saving fails, so the input is not lost", async () => {
    vi.mocked(updateEmployee).mockRejectedValueOnce(new Error("Service unavailable"));
    const { user, onClose } = renderForm({ employee: existing });

    await user.clear(screen.getByLabelText("Last name"));
    await user.type(screen.getByLabelText("Last name"), "Sharma");
    await user.click(save());

    await waitFor(() => expect(updateEmployee).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });
});
