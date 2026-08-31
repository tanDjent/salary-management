import { api, buildUrl } from "./client";

export type Lookup = {
  id: number;
  name: string;
};

export type JobLevel = {
  id: number;
  title: string;
  rank: number;
};

/** Amounts are strings, not numbers: the API sends exact decimals, and parsing
 *  them into JS floats would reintroduce the rounding the backend avoids. */
export type Salary = {
  amount: string;
  currency: string;
  amount_usd: string;
};

export type Employee = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  country: Lookup;
  department: Lookup;
  job_level: JobLevel;
  salary: Salary;
  hire_date: string;
  is_active: boolean;
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export type EmployeeSortField =
  | "last_name"
  | "first_name"
  | "hire_date"
  | "salary_usd";

export type SortDirection = "asc" | "desc";

export type EmployeeFilters = {
  page: number;
  page_size: number;
  q?: string;
  country_id?: number[];
  department_id?: number[];
  job_level_id?: number[];
  is_active?: boolean;
  sort_by: EmployeeSortField;
  sort_dir: SortDirection;
};

export function fetchEmployees(filters: EmployeeFilters): Promise<Page<Employee>> {
  return api.get<Page<Employee>>(buildUrl("/employees", { ...filters }));
}

export function fetchEmployee(id: number): Promise<Employee> {
  return api.get<Employee>(buildUrl(`/employees/${id}`));
}

/** Only the fields the user actually changed are sent, so a PATCH never
 *  overwrites a value someone else edited in the meantime. */
export type EmployeeUpdate = {
  first_name?: string;
  last_name?: string;
  email?: string;
  country_id?: number;
  department_id?: number;
  job_level_id?: number;
  salary?: string;
  hire_date?: string;
};

export function updateEmployee(
  id: number,
  changes: EmployeeUpdate,
): Promise<Employee> {
  return api.patch<Employee>(buildUrl(`/employees/${id}`), changes);
}

export function setEmployeeActive(id: number, isActive: boolean): Promise<Employee> {
  const action = isActive ? "reactivate" : "deactivate";
  return api.post<Employee>(buildUrl(`/employees/${id}/${action}`));
}
